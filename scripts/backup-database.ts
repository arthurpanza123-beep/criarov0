import { config } from "dotenv"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, readdirSync, statSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { logger as baseLogger } from "@/lib/observability/logger"
import { getDb, closeDatabaseClient } from "@/lib/db"
import { upsertSetting } from "@/lib/services/settings-service"
import { applyRetention, backupFilename, backupTimestamp, parseDatabaseUrl, sha256File } from "@/lib/ops/backup-retention"

config({ path: ".env.local", quiet: true })

const logger = baseLogger.child({ script: "backup-database" })

const BACKUP_DIR = process.env.BACKUP_DIR?.trim() || join(process.cwd(), "backups")
const RETENTION = {
  daily: Number(process.env.BACKUP_RETENTION_DAILY) || 7,
  weekly: Number(process.env.BACKUP_RETENTION_WEEKLY) || 4,
  monthly: Number(process.env.BACKUP_RETENTION_MONTHLY) || 6,
}
const PG_BIN_DIR = process.env.PG_BIN_DIR?.trim() || "/usr/lib/postgresql/17/bin"
const LAST_BACKUP_STATUS_KEY = "ops.lastBackupStatus"

class BackupError extends Error {}

function runPgDump(conn: ReturnType<typeof parseDatabaseUrl>, outFile: string) {
  const env = { ...process.env, PGPASSWORD: conn.password }
  const result = spawnSync(
    `${PG_BIN_DIR}/pg_dump`,
    ["-h", conn.host, "-p", conn.port, "-U", conn.user, "-d", conn.database, "-F", "c", "-f", outFile],
    { env, encoding: "utf-8", timeout: 10 * 60 * 1000 },
  )
  if (result.error) throw new BackupError(`pg_dump failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    // stderr from pg_dump can include the DSN in some failure modes; never log it raw.
    throw new BackupError(`pg_dump exited with status ${result.status}.`)
  }
}

function verifyDump(outFile: string) {
  const result = spawnSync(`${PG_BIN_DIR}/pg_restore`, ["--list", outFile], { encoding: "utf-8", timeout: 60_000 })
  if (result.status !== 0) throw new BackupError("pg_restore --list failed on the produced dump (corrupt backup).")
  return result.stdout.split("\n").filter(Boolean).length
}

function writeStatusFile(dir: string, status: Record<string, unknown>) {
  writeFileSync(join(dir, "last-backup.json"), JSON.stringify(status, null, 2), { mode: 0o600 })
}

async function persistStatusToDatabase(status: Record<string, unknown>) {
  try {
    await upsertSetting(LAST_BACKUP_STATUS_KEY, status, getDb())
  } catch (error) {
    // The file-based status (last-backup.json) is still authoritative for the
    // CLI/manual flow; a DB write failure here must not turn a successful
    // backup into a reported failure.
    logger.warn("could not persist backup status to database", {
      error: error instanceof Error ? error.message : String(error),
    })
  } finally {
    await closeDatabaseClient().catch(() => {})
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new BackupError("DATABASE_URL is not set.")

  mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 })

  // Clean up .tmp leftovers from a previous run that crashed before the atomic
  // rename (e.g. process killed mid-dump). These are always incomplete dumps.
  for (const name of readdirSync(BACKUP_DIR)) {
    if (name.endsWith(".dump.tmp")) unlinkSync(join(BACKUP_DIR, name))
  }

  const conn = parseDatabaseUrl(databaseUrl)
  const filename = backupFilename(backupTimestamp())
  const finalPath = join(BACKUP_DIR, filename)
  const tmpPath = `${finalPath}.tmp`

  const startedAt = Date.now()
  logger.info("backup started", { database: conn.database, dir: BACKUP_DIR })

  runPgDump(conn, tmpPath)
  renameSync(tmpPath, finalPath) // atomic on the same filesystem: no half-written dump under the final name
  chmodSync(finalPath, 0o600)

  const size = statSync(finalPath).size
  const sha256 = sha256File(finalPath)
  writeFileSync(`${finalPath}.sha256`, `${sha256}  ${filename}\n`, { mode: 0o600 })

  const tocEntries = verifyDump(finalPath)
  const removed = applyRetention(BACKUP_DIR, RETENTION)

  const durationMs = Date.now() - startedAt
  const status = {
    status: "ok",
    file: filename,
    sizeBytes: size,
    sha256,
    tocEntries,
    removed,
    durationMs,
    finishedAt: new Date().toISOString(),
  }
  writeStatusFile(BACKUP_DIR, status)
  await persistStatusToDatabase(status)

  logger.info("backup completed", { file: filename, sizeBytes: size, sha256, tocEntries, durationMs, removedCount: removed.length })
}

main()
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown backup failure."
    logger.error("backup failed", { error: message })
    const status = { status: "failed", error: message, finishedAt: new Date().toISOString() }
    try {
      writeStatusFile(BACKUP_DIR, status)
    } catch {
      // Never let a secondary failure while writing the status file mask the real exit code.
    }
    await persistStatusToDatabase(status)
    process.exit(1)
  })
