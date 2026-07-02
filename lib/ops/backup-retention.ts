import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** Parses host/port/db/role from a Postgres connection string without ever exposing the password. */
export function parseDatabaseUrl(raw: string) {
  const url = new URL(raw)
  return {
    host: url.hostname || "127.0.0.1",
    port: url.port || "5432",
    database: url.pathname.replace(/^\//, ""),
    user: decodeURIComponent(url.username || "postgres"),
    password: decodeURIComponent(url.password || ""),
  }
}

export function backupTimestamp(now: Date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

/** Safe, filesystem-friendly backup filename: fixed prefix + strict numeric timestamp, no user input. */
export function backupFilename(ts: string) {
  return `criarov0-${ts}.dump`
}

/** Rejects any filename that isn't the exact expected shape (defense in depth against path traversal / injection via a crafted BACKUP_DIR listing). */
export function isSafeBackupFilename(name: string) {
  return /^criarov0-(?:weekly-|monthly-)?\d{8}-\d{6}\.dump$/.test(name)
}

export function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex")
}

export function sha256File(path: string) {
  return sha256Buffer(readFileSync(path))
}

export type BackupClass = "daily" | "weekly" | "monthly"

export function classify(name: string): BackupClass | null {
  if (name.startsWith("criarov0-weekly-")) return "weekly"
  if (name.startsWith("criarov0-monthly-")) return "monthly"
  if (name.startsWith("criarov0-") && name.endsWith(".dump")) return "daily"
  return null
}

export type RetentionPolicy = { daily: number; weekly: number; monthly: number }

export function copyWithChecksum(sourcePath: string, targetPath: string) {
  const buffer = readFileSync(sourcePath)
  writeFileSync(targetPath, buffer, { mode: 0o600 })
  const sha = sha256Buffer(buffer)
  writeFileSync(`${targetPath}.sha256`, `${sha}  ${targetPath.split("/").pop()}\n`, { mode: 0o600 })
}

/**
 * Applies a simple, deterministic retention policy directly on the backup
 * directory's file set: keeps the newest N daily dumps, promotes the oldest
 * surviving daily to a "weekly" name (up to W copies) and to a "monthly" name
 * (up to M copies) before it would otherwise be deleted, then removes
 * anything beyond each bucket's limit. Pure filesystem operation — no DB
 * access — so it is safe to unit test against a throwaway directory.
 */
export function applyRetention(dir: string, policy: RetentionPolicy) {
  const files = readdirSync(dir).filter((name) => name.endsWith(".dump"))
  const daily = files.filter((name) => classify(name) === "daily").sort().reverse()
  const weekly = files.filter((name) => classify(name) === "weekly").sort().reverse()
  const monthly = files.filter((name) => classify(name) === "monthly").sort().reverse()

  const removed: string[] = []

  // Promote candidates before trimming dailies, so we never lose the only copy.
  const weeklyCandidate = daily[policy.daily]
  if (weeklyCandidate && weekly.length < policy.weekly) {
    const target = weeklyCandidate.replace(/^criarov0-/, "criarov0-weekly-")
    if (!existsSync(join(dir, target))) copyWithChecksum(join(dir, weeklyCandidate), join(dir, target))
  }
  const monthlyCandidate = daily[policy.daily]
  if (monthlyCandidate && monthly.length < policy.monthly) {
    const target = monthlyCandidate.replace(/^criarov0-/, "criarov0-monthly-")
    if (!existsSync(join(dir, target))) copyWithChecksum(join(dir, monthlyCandidate), join(dir, target))
  }

  const removeExcess = (names: string[], limit: number) => {
    for (const name of names.slice(limit)) {
      unlinkSync(join(dir, name))
      removed.push(name)
      const sha = join(dir, `${name}.sha256`)
      if (existsSync(sha)) unlinkSync(sha)
    }
  }
  removeExcess(daily, policy.daily)
  removeExcess(weekly, policy.weekly)
  removeExcess(monthly, policy.monthly)

  return removed
}
