import "server-only"

import { and, asc, count, desc, eq, inArray, lt, lte, or, sql } from "drizzle-orm"

import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { jobRuns, jobs, type JobRow, type NewJobRow } from "@/lib/db/schema"

type Db = ReturnType<typeof getDb>

export const JOB_TYPES = [
  "reconcile_account",
  "generate_notification",
  "import_entities",
  "export_report",
  "maintenance",
] as const
export type JobType = (typeof JOB_TYPES)[number]

export const JOB_STATUSES = [
  "pending",
  "scheduled",
  "running",
  "completed",
  "failed",
  "dead_letter",
  "cancelled",
] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export type JobRunStatus = "running" | "completed" | "failed" | "timeout" | "cancelled"

const DEFAULT_BASE_BACKOFF_MS = 2_000
const DEFAULT_MAX_BACKOFF_MS = 5 * 60 * 1_000

/** Deterministic exponential backoff (no jitter, so it is testable). */
export function computeBackoffMs(attempt: number, base = DEFAULT_BASE_BACKOFF_MS, cap = DEFAULT_MAX_BACKOFF_MS) {
  if (attempt <= 0) return 0
  const raw = base * 2 ** (attempt - 1)
  return Math.min(raw, cap)
}

export type EnqueueInput = {
  type: JobType
  payload?: Record<string, unknown>
  priority?: number
  runAt?: Date
  maxAttempts?: number
  timeoutMs?: number
  idempotencyKey?: string | null
  createdBy?: string | null
}

/**
 * Inserts a job. When an idempotencyKey is provided and already exists, the
 * existing job is returned instead of creating a duplicate (dedup / idempotency).
 */
export async function enqueueJob(input: EnqueueInput, db: Db = getDb()): Promise<JobRow> {
  const runAt = input.runAt ?? new Date()
  const scheduled = runAt.getTime() > Date.now()
  const values: NewJobRow = {
    type: input.type,
    payload: input.payload ?? {},
    priority: input.priority ?? 0,
    runAt,
    status: scheduled ? "scheduled" : "pending",
    maxAttempts: input.maxAttempts ?? 3,
    timeoutMs: input.timeoutMs ?? 30_000,
    idempotencyKey: input.idempotencyKey ?? null,
    createdBy: input.createdBy ?? null,
  }

  if (values.idempotencyKey) {
    const [inserted] = await db
      .insert(jobs)
      .values(values)
      .onConflictDoNothing({ target: jobs.idempotencyKey })
      .returning()
    if (inserted) return inserted
    const [existing] = await db.select().from(jobs).where(eq(jobs.idempotencyKey, values.idempotencyKey)).limit(1)
    if (!existing) throw new Error("Não foi possível enfileirar o job idempotente.")
    return existing
  }

  const [row] = await db.insert(jobs).values(values).returning()
  return row
}

/**
 * Atomically claims the next runnable job using FOR UPDATE SKIP LOCKED so that
 * concurrent workers never grab the same job. Also reclaims jobs stuck in
 * "running" past their timeout (e.g. after a worker crash). Increments attempts.
 */
export async function claimNextJob(workerId: string, db: Db = getDb()): Promise<JobRow | null> {
  return db.transaction(async (tx) => {
    const now = new Date()
    const [candidate] = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        or(
          and(inArray(jobs.status, ["pending", "scheduled"]), lte(jobs.runAt, now)),
          and(
            eq(jobs.status, "running"),
            sql`${jobs.lockedAt} is not null and ${jobs.lockedAt} < now() - make_interval(secs => ${jobs.timeoutMs}::double precision / 1000.0)`,
            sql`${jobs.attempts} < ${jobs.maxAttempts}`,
          ),
        ),
      )
      .orderBy(desc(jobs.priority), asc(jobs.runAt))
      .limit(1)
      .for("update", { skipLocked: true })

    if (!candidate) return null

    const [claimed] = await tx
      .update(jobs)
      .set({
        status: "running",
        lockedAt: now,
        lockedBy: workerId,
        startedAt: now,
        attempts: sql`${jobs.attempts} + 1`,
        updatedAt: now,
      })
      .where(eq(jobs.id, candidate.id))
      .returning()

    return claimed ?? null
  })
}

export async function completeJob(id: string, result: Record<string, unknown> = {}, db: Db = getDb()): Promise<JobRow | null> {
  const now = new Date()
  const [row] = await db
    .update(jobs)
    .set({ status: "completed", result, error: null, finishedAt: now, lockedAt: null, lockedBy: null, updatedAt: now })
    .where(eq(jobs.id, id))
    .returning()
  return row ?? null
}

/**
 * Fails a job. If retries remain, reschedules it (pending) with exponential
 * backoff; otherwise moves it to the dead-letter state (permanent failure).
 */
export async function failJob(id: string, error: string, db: Db = getDb()): Promise<JobRow | null> {
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(jobs).where(eq(jobs.id, id)).limit(1)
    if (!current) return null
    const now = new Date()
    if (current.attempts >= current.maxAttempts) {
      const [row] = await tx
        .update(jobs)
        .set({ status: "dead_letter", error, finishedAt: now, lockedAt: null, lockedBy: null, updatedAt: now })
        .where(eq(jobs.id, id))
        .returning()
      return row ?? null
    }
    const runAt = new Date(now.getTime() + computeBackoffMs(current.attempts))
    const [row] = await tx
      .update(jobs)
      .set({ status: "pending", error, runAt, lockedAt: null, lockedBy: null, updatedAt: now })
      .where(eq(jobs.id, id))
      .returning()
    return row ?? null
  })
}

/** Cancels a job that is not currently running or completed. */
export async function cancelJob(id: string, db: Db = getDb()): Promise<JobRow | null> {
  const now = new Date()
  const [row] = await db
    .update(jobs)
    .set({ status: "cancelled", finishedAt: now, lockedAt: null, lockedBy: null, updatedAt: now })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["pending", "scheduled", "failed", "dead_letter"])))
    .returning()
  return row ?? null
}

/** Manually re-queues a terminal job for a fresh run (attempts reset to 0). */
export async function retryJob(id: string, db: Db = getDb()): Promise<JobRow | null> {
  const now = new Date()
  const [row] = await db
    .update(jobs)
    .set({
      status: "pending",
      attempts: 0,
      error: null,
      result: null,
      runAt: now,
      lockedAt: null,
      lockedBy: null,
      startedAt: null,
      finishedAt: null,
      updatedAt: now,
    })
    .where(and(eq(jobs.id, id), inArray(jobs.status, ["failed", "dead_letter", "cancelled", "completed"])))
    .returning()
  return row ?? null
}

export async function recordJobRun(
  input: {
    jobId: string
    attempt: number
    status: JobRunStatus
    startedAt: Date
    finishedAt?: Date | null
    durationMs?: number | null
    error?: string | null
    logs?: unknown[]
  },
  db: Db = getDb(),
) {
  const [row] = await db
    .insert(jobRuns)
    .values({
      jobId: input.jobId,
      attempt: input.attempt,
      status: input.status,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt ?? null,
      durationMs: input.durationMs ?? null,
      error: input.error ?? null,
      logs: input.logs ?? [],
    })
    .returning()
  return row
}

export async function listJobs(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.status ? eq(jobs.status, input.status as JobStatus) : undefined,
    input.type ? eq(jobs.type, input.type as JobType) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined
  const [totalRow] = await db.select({ value: count() }).from(jobs).where(where)
  const data = await db
    .select()
    .from(jobs)
    .where(where)
    .orderBy(desc(jobs.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)
  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function getJob(id: string, db: Db = getDb()) {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1)
  return row ?? null
}

export async function listJobRuns(jobId: string, db: Db = getDb()) {
  return db.select().from(jobRuns).where(eq(jobRuns.jobId, jobId)).orderBy(desc(jobRuns.createdAt)).limit(50)
}

export async function jobStats(db: Db = getDb()): Promise<Record<JobStatus, number>> {
  const rows = await db.select({ status: jobs.status, value: count() }).from(jobs).groupBy(jobs.status)
  const stats = Object.fromEntries(JOB_STATUSES.map((status) => [status, 0])) as Record<JobStatus, number>
  for (const row of rows) stats[row.status as JobStatus] = Number(row.value)
  return stats
}

export async function queueHealth(db: Db = getDb()) {
  const stats = await jobStats(db)
  const [oldest] = await db
    .select({ runAt: jobs.runAt })
    .from(jobs)
    .where(inArray(jobs.status, ["pending", "scheduled"]))
    .orderBy(asc(jobs.runAt))
    .limit(1)
  const oldestPendingMs = oldest ? Math.max(0, Date.now() - new Date(oldest.runAt).getTime()) : 0
  return {
    stats,
    pending: stats.pending + stats.scheduled,
    running: stats.running,
    failed: stats.failed,
    deadLetter: stats.dead_letter,
    oldestPendingMs,
  }
}

/**
 * Safe maintenance: removes old job_runs and old terminal (completed/cancelled)
 * jobs beyond the retention window. Never touches business data or dead-letter
 * jobs (kept for audit).
 */
export async function pruneOldJobs(retentionDays: number, db: Db = getDb()) {
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000)
  const removedRuns = await db.delete(jobRuns).where(lt(jobRuns.createdAt, cutoff)).returning({ id: jobRuns.id })
  const removedJobs = await db
    .delete(jobs)
    .where(and(inArray(jobs.status, ["completed", "cancelled"]), lt(jobs.finishedAt, cutoff)))
    .returning({ id: jobs.id })
  return { removedJobRuns: removedRuns.length, removedJobs: removedJobs.length }
}

export const jobsService = {
  enqueue: enqueueJob,
  claim: claimNextJob,
  complete: completeJob,
  fail: failJob,
  cancel: cancelJob,
  retry: retryJob,
  recordRun: recordJobRun,
  list: listJobs,
  get: getJob,
  listRuns: listJobRuns,
  stats: jobStats,
  health: queueHealth,
  computeBackoffMs,
  prune: pruneOldJobs,
}
