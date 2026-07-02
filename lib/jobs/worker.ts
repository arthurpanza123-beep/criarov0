import "server-only"

import { randomUUID } from "node:crypto"

import { handlers } from "@/lib/jobs/handlers"
import { newCorrelationId } from "@/lib/observability/correlation"
import { safeErrorMessage } from "@/lib/observability/errors"
import { logger as baseLogger } from "@/lib/observability/logger"
import { versionInfo } from "@/lib/observability/version"
import type { JobRow } from "@/lib/db/schema"
import { claimNextJob, completeJob, failJob, recordJobRun } from "@/lib/services/jobs-service"
import { upsertSetting } from "@/lib/services/settings-service"
import { getDb } from "@/lib/db"

export const WORKER_HEARTBEAT_KEY = "ops.workerHeartbeat"
const HEARTBEAT_INTERVAL_MS = 15_000

async function writeHeartbeat(workerId: string) {
  try {
    await upsertSetting(WORKER_HEARTBEAT_KEY, { workerId, at: new Date().toISOString() }, getDb())
  } catch {
    // A missed heartbeat write must never crash the worker loop; monitoring
    // will simply see a stale heartbeat on the next check.
  }
}

class TimeoutError extends Error {}

/** Exported for direct unit testing of the exact timeout race used by runClaimedJob. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`Job excedeu o timeout de ${ms}ms.`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>
}

function sleep(ms: number, shouldStop: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const step = Math.min(ms, 250)
    let elapsed = 0
    const tick = () => {
      if (shouldStop() || elapsed >= ms) return resolve()
      elapsed += step
      setTimeout(tick, step)
    }
    setTimeout(tick, step)
  })
}

export async function runClaimedJob(job: JobRow, workerId: string): Promise<"completed" | "failed"> {
  const correlationId = newCorrelationId()
  const logger = baseLogger.child({
    workerId,
    correlationId,
    jobId: job.id,
    jobType: job.type,
    attempt: job.attempts,
  })
  const startedAt = new Date()
  logger.info("job started")

  try {
    const handler = handlers[job.type]
    if (!handler) throw new Error(`Handler não encontrado para o tipo "${job.type}".`)
    const result = await withTimeout(
      handler((job.payload ?? {}) as Record<string, unknown>, { jobId: job.id, attempt: job.attempts, logger }),
      job.timeoutMs,
    )
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    await completeJob(job.id, result ?? {})
    await recordJobRun({ jobId: job.id, attempt: job.attempts, status: "completed", startedAt, finishedAt, durationMs })
    logger.info("job completed", { durationMs })
    return "completed"
  } catch (error) {
    const finishedAt = new Date()
    const durationMs = finishedAt.getTime() - startedAt.getTime()
    const message = safeErrorMessage(error)
    const isTimeout = error instanceof TimeoutError
    await failJob(job.id, message)
    await recordJobRun({
      jobId: job.id,
      attempt: job.attempts,
      status: isTimeout ? "timeout" : "failed",
      startedAt,
      finishedAt,
      durationMs,
      error: message,
    })
    logger.error("job failed", { error: message, timeout: isTimeout })
    return "failed"
  }
}

/** Processes up to `max` ready jobs and returns the number processed. Used by tests and cron-style triggers. */
export async function runQueueOnce(workerId = `tick-${randomUUID()}`, max = 25): Promise<number> {
  let processed = 0
  for (let i = 0; i < max; i += 1) {
    const job = await claimNextJob(workerId)
    if (!job) break
    await runClaimedJob(job, workerId)
    processed += 1
  }
  return processed
}

export type WorkerOptions = { workerId?: string; pollIntervalMs?: number }

/** Long-running worker loop with graceful shutdown on SIGTERM/SIGINT. */
export async function runWorker(options: WorkerOptions = {}): Promise<void> {
  const workerId = options.workerId ?? `worker-${randomUUID()}`
  const pollIntervalMs = options.pollIntervalMs ?? 2_000
  const logger = baseLogger.child({ workerId })
  let running = true

  const shutdown = (signal: string) => {
    if (!running) return
    logger.info("shutdown requested", { signal })
    running = false
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"))
  process.once("SIGINT", () => shutdown("SIGINT"))

  logger.info("worker started", { pollIntervalMs, ...versionInfo() })
  await writeHeartbeat(workerId)
  let lastHeartbeatAt = Date.now()
  while (running) {
    try {
      const job = await claimNextJob(workerId)
      if (Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
        await writeHeartbeat(workerId)
        lastHeartbeatAt = Date.now()
      }
      if (job) {
        await runClaimedJob(job, workerId)
        continue // immediately try the next job
      }
    } catch (error) {
      logger.error("worker loop error", { error: safeErrorMessage(error) })
    }
    if (!running) break
    await sleep(pollIntervalMs, () => !running)
  }
  logger.info("worker stopped")
}
