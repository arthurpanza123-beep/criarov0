import "server-only"

import { statfsSync } from "node:fs"
import { and, eq, lt, sql } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { jobs } from "@/lib/db/schema"
import { getSetting, upsertSetting } from "@/lib/services/settings-service"
import { queueHealth } from "@/lib/services/jobs-service"
import { notificationsService } from "@/lib/services/notifications-service"
import { WORKER_HEARTBEAT_KEY } from "@/lib/jobs/worker"

export const MONITOR_STATUS_KEY = "ops.lastMonitorRun"
const LAST_BACKUP_STATUS_KEY = "ops.lastBackupStatus" // mirrors backups/last-backup.json, written by the monitor script

export type CheckSeverity = "ok" | "warn" | "critical"

export type CheckResult = {
  name: string
  severity: CheckSeverity
  message: string
  detail?: Record<string, unknown>
}

export type MonitorReport = {
  checks: CheckResult[]
  severity: CheckSeverity
  generatedAt: string
}

const WORKER_STALE_MS = 60_000 // worker writes a heartbeat every ~15s; 4 misses => offline
const BACKUP_MAX_AGE_MS = 26 * 60 * 60 * 1000 // daily backup at 03:15 UTC; 26h gives slack for delays
const DEAD_LETTER_WARN = 1
const DEAD_LETTER_CRITICAL = 10
const OLDEST_PENDING_WARN_MS = 5 * 60 * 1000
const OLDEST_PENDING_CRITICAL_MS = 30 * 60 * 1000
const STALE_RUNNING_WARN_MS = 5 * 60 * 1000
const DISK_WARN_RATIO = 0.85
const DISK_CRITICAL_RATIO = 0.95

function worst(a: CheckSeverity, b: CheckSeverity): CheckSeverity {
  const rank: Record<CheckSeverity, number> = { ok: 0, warn: 1, critical: 2 }
  return rank[a] >= rank[b] ? a : b
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await getDb().execute(sql`select 1`)
    return { name: "database", severity: "ok", message: "Banco de dados acessível." }
  } catch {
    return { name: "database", severity: "critical", message: "Banco de dados inacessível." }
  }
}

async function checkWorkerHeartbeat(): Promise<CheckResult> {
  const row = await getSetting(WORKER_HEARTBEAT_KEY, getDb())
  if (!row) return { name: "worker", severity: "critical", message: "Worker nunca reportou heartbeat." }
  const value = row.value as { workerId?: string; at?: string } | null
  const at = value?.at ? new Date(value.at).getTime() : 0
  const ageMs = Date.now() - at
  if (!at || ageMs > WORKER_STALE_MS) {
    return {
      name: "worker",
      severity: "critical",
      message: "Worker offline (sem heartbeat recente).",
      detail: { ageMs },
    }
  }
  return { name: "worker", severity: "ok", message: "Worker ativo.", detail: { ageMs } }
}

async function checkQueue(): Promise<CheckResult[]> {
  const health = await queueHealth(getDb())
  const results: CheckResult[] = []

  const pendingSeverity: CheckSeverity =
    health.oldestPendingMs >= OLDEST_PENDING_CRITICAL_MS ? "critical" : health.oldestPendingMs >= OLDEST_PENDING_WARN_MS ? "warn" : "ok"
  results.push({
    name: "queue_backlog",
    severity: pendingSeverity,
    message:
      pendingSeverity === "ok"
        ? "Fila sem acúmulo relevante."
        : `Job pendente há ${Math.round(health.oldestPendingMs / 1000)}s.`,
    detail: { pending: health.pending, running: health.running, oldestPendingMs: health.oldestPendingMs },
  })

  const deadLetterSeverity: CheckSeverity =
    health.deadLetter >= DEAD_LETTER_CRITICAL ? "critical" : health.deadLetter >= DEAD_LETTER_WARN ? "warn" : "ok"
  results.push({
    name: "dead_letter",
    severity: deadLetterSeverity,
    message: deadLetterSeverity === "ok" ? "Sem jobs em dead-letter." : `${health.deadLetter} job(s) em dead-letter.`,
    detail: { deadLetter: health.deadLetter },
  })

  return results
}

/** Jobs stuck in "running" past their timeout that have not yet been reclaimed. */
async function checkStuckJobs(): Promise<CheckResult> {
  const db = getDb()
  const cutoff = new Date(Date.now() - STALE_RUNNING_WARN_MS)
  const stuck = await db
    .select({ id: jobs.id, type: jobs.type })
    .from(jobs)
    .where(and(eq(jobs.status, "running"), lt(jobs.lockedAt, cutoff)))
    .limit(10)
  if (stuck.length === 0) return { name: "stuck_jobs", severity: "ok", message: "Nenhum job preso." }
  return {
    name: "stuck_jobs",
    severity: "warn",
    message: `${stuck.length} job(s) presos em execução além do esperado (aguardando reivindicação).`,
    detail: { count: stuck.length },
  }
}

async function checkBackup(): Promise<CheckResult> {
  const row = await getSetting(LAST_BACKUP_STATUS_KEY, getDb())
  if (!row) return { name: "backup", severity: "warn", message: "Nenhum backup registrado ainda." }
  const value = row.value as { status?: string; finishedAt?: string; error?: string } | null
  if (!value?.finishedAt) return { name: "backup", severity: "warn", message: "Status de backup incompleto." }
  const ageMs = Date.now() - new Date(value.finishedAt).getTime()
  if (value.status !== "ok") {
    return { name: "backup", severity: "critical", message: "Último backup falhou.", detail: { error: value.error, ageMs } }
  }
  if (ageMs > BACKUP_MAX_AGE_MS) {
    return { name: "backup", severity: "critical", message: "Backup atrasado (mais de 26h desde o último sucesso).", detail: { ageMs } }
  }
  return { name: "backup", severity: "ok", message: "Backup recente e bem-sucedido.", detail: { ageMs } }
}

/** Uses statfs (no shelling out to `df`) to check free space on the backups' filesystem. */
function checkDisk(path: string = process.cwd()): CheckResult {
  try {
    const stats = statfsSync(path)
    const total = stats.blocks * stats.bsize
    const free = stats.bfree * stats.bsize
    const usedRatio = total > 0 ? 1 - free / total : 0
    const severity: CheckSeverity = usedRatio >= DISK_CRITICAL_RATIO ? "critical" : usedRatio >= DISK_WARN_RATIO ? "warn" : "ok"
    return {
      name: "disk",
      severity,
      message: severity === "ok" ? "Espaço em disco confortável." : `Disco em ${Math.round(usedRatio * 100)}% de uso.`,
      detail: { usedRatio: Math.round(usedRatio * 1000) / 1000, freeBytes: free, totalBytes: total },
    }
  } catch {
    return { name: "disk", severity: "warn", message: "Não foi possível verificar o espaço em disco." }
  }
}

/**
 * Runs every operational check and aggregates the worst severity. Never
 * throws: an individual check failing degrades to a "critical"/"warn" result
 * for that check instead of crashing the whole report.
 */
export async function runMonitorChecks(): Promise<MonitorReport> {
  const [database, worker, queueChecks, stuckJobs, backup] = await Promise.all([
    checkDatabase(),
    checkWorkerHeartbeat(),
    checkQueue(),
    checkStuckJobs(),
    checkBackup(),
  ])
  const disk = checkDisk()

  const checks = [database, worker, ...queueChecks, stuckJobs, backup, disk]
  const severity = checks.reduce<CheckSeverity>((acc, check) => worst(acc, check.severity), "ok")

  return { checks, severity, generatedAt: new Date().toISOString() }
}

/**
 * Persists the report for the /sistema page and raises an internal
 * notification only on a state transition (ok -> degraded, or the specific
 * failing check changed) to avoid spamming a notification on every timer
 * tick while a known issue is still being fixed.
 */
export async function runMonitorAndNotify(): Promise<MonitorReport> {
  const db = getDb()
  const previous = await getSetting(MONITOR_STATUS_KEY, db)
  const previousSeverity = (previous?.value as { severity?: CheckSeverity } | null)?.severity ?? "ok"
  const previousFailing = new Set(
    ((previous?.value as { failing?: string[] } | null)?.failing ?? []) as string[],
  )

  const report = await runMonitorChecks()
  const failing = report.checks.filter((check) => check.severity !== "ok")
  const failingNames = new Set(failing.map((check) => check.name))

  await upsertSetting(MONITOR_STATUS_KEY, { ...report, failing: [...failingNames] }, db)

  const isNewIncident = report.severity !== "ok" && (previousSeverity === "ok" || !setsEqual(previousFailing, failingNames))
  const isRecovered = report.severity === "ok" && previousSeverity !== "ok"

  if (isNewIncident) {
    await notificationsService.create({
      title: report.severity === "critical" ? "Alerta operacional crítico" : "Alerta operacional",
      message: failing.map((check) => check.message).join(" "),
      type: report.severity === "critical" ? "error" : "warning",
    })
  } else if (isRecovered) {
    await notificationsService.create({
      title: "Operação normalizada",
      message: "Todas as checagens operacionais voltaram ao normal.",
      type: "success",
    })
  }

  return report
}

function setsEqual(a: Set<string>, b: Set<string>) {
  if (a.size !== b.size) return false
  for (const value of a) if (!b.has(value)) return false
  return true
}

export async function getLastMonitorReport(): Promise<MonitorReport | null> {
  const row = await getSetting(MONITOR_STATUS_KEY, getDb())
  return (row?.value as MonitorReport | null) ?? null
}

export const monitoringService = {
  run: runMonitorChecks,
  runAndNotify: runMonitorAndNotify,
  lastReport: getLastMonitorReport,
}
