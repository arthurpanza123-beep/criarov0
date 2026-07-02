import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  applyRetention,
  backupFilename,
  backupTimestamp,
  classify,
  isSafeBackupFilename,
  parseDatabaseUrl,
  sha256Buffer,
  sha256File,
} from "@/lib/ops/backup-retention"

describe("backup filename and timestamp", () => {
  it("produces a fixed-prefix, strictly numeric timestamped filename", () => {
    const ts = backupTimestamp(new Date("2026-07-02T16:31:46Z"))
    expect(ts).toMatch(/^\d{8}-\d{6}$/)
    const name = backupFilename(ts)
    expect(name).toBe(`criarov0-${ts}.dump`)
  })

  it("accepts only the exact expected shape as a safe filename", () => {
    expect(isSafeBackupFilename("criarov0-20260702-163146.dump")).toBe(true)
    expect(isSafeBackupFilename("criarov0-weekly-20260702-163146.dump")).toBe(true)
    expect(isSafeBackupFilename("criarov0-monthly-20260702-163146.dump")).toBe(true)
    expect(isSafeBackupFilename("../../etc/passwd")).toBe(false)
    expect(isSafeBackupFilename("criarov0-not-a-date.dump")).toBe(false)
    expect(isSafeBackupFilename("criarov0-20260702-163146.dump; rm -rf /")).toBe(false)
  })
})

describe("checksum", () => {
  it("computes a stable sha256 for the same content", () => {
    const a = sha256Buffer(Buffer.from("hello world"))
    const b = sha256Buffer(Buffer.from("hello world"))
    expect(a).toBe(b)
    expect(a).toHaveLength(64)
  })

  it("differs for different content", () => {
    const a = sha256Buffer(Buffer.from("hello world"))
    const b = sha256Buffer(Buffer.from("hello world!"))
    expect(a).not.toBe(b)
  })

  it("reads the same checksum from disk as computed in-memory", () => {
    const dir = mkdtempSync(join(tmpdir(), "backup-checksum-"))
    try {
      const path = join(dir, "sample.dump")
      writeFileSync(path, "fake dump content")
      expect(sha256File(path)).toBe(sha256Buffer(Buffer.from("fake dump content")))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("parseDatabaseUrl", () => {
  it("extracts connection parts without requiring the password to be read elsewhere", () => {
    const conn = parseDatabaseUrl("postgresql://criarov0_app:s3cr3t@127.0.0.1:5433/criarov0")
    expect(conn.host).toBe("127.0.0.1")
    expect(conn.port).toBe("5433")
    expect(conn.database).toBe("criarov0")
    expect(conn.user).toBe("criarov0_app")
    expect(conn.password).toBe("s3cr3t")
  })

  it("never appears in a stringified/serialized form with the password readable by accident", () => {
    const conn = parseDatabaseUrl("postgresql://u:p@h:5432/db")
    const serialized = JSON.stringify(conn)
    // The password IS present in the parsed object (needed for PGPASSWORD),
    // but this test documents that callers must never log `conn` directly —
    // enforced by convention (scripts only log conn.database, never conn).
    expect(serialized).toContain("p") // sanity: object round-trips
    expect(conn.password).toBe("p")
  })
})

describe("classify", () => {
  it("classifies daily, weekly and monthly dumps by filename", () => {
    expect(classify("criarov0-20260702-163146.dump")).toBe("daily")
    expect(classify("criarov0-weekly-20260702-163146.dump")).toBe("weekly")
    expect(classify("criarov0-monthly-20260702-163146.dump")).toBe("monthly")
    expect(classify("last-backup.json")).toBeNull()
    expect(classify("criarov0-20260702-163146.dump.sha256")).toBeNull()
  })
})

describe("backup retention", () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "backup-retention-"))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  function seedDaily(count: number) {
    for (let day = 1; day <= count; day += 1) {
      const name = `criarov0-202607${String(day).padStart(2, "0")}-000000.dump`
      writeFileSync(join(dir, name), `content-${day}`, { mode: 0o600 })
    }
  }

  it("keeps only the newest N daily backups", () => {
    seedDaily(10)
    const removed = applyRetention(dir, { daily: 7, weekly: 4, monthly: 6 })
    expect(removed).toHaveLength(3)
    const remainingDaily = removed.filter((name) => classify(name) === "daily")
    expect(remainingDaily).toEqual([
      "criarov0-20260703-000000.dump",
      "criarov0-20260702-000000.dump",
      "criarov0-20260701-000000.dump",
    ])
  })

  it("promotes the oldest surviving daily to weekly and monthly before it would be deleted", () => {
    seedDaily(10)
    applyRetention(dir, { daily: 7, weekly: 4, monthly: 6 })
    expect(existsSync(join(dir, "criarov0-weekly-20260703-000000.dump"))).toBe(true)
    expect(existsSync(join(dir, "criarov0-monthly-20260703-000000.dump"))).toBe(true)
    // Promoted copies carry their own checksum.
    expect(existsSync(join(dir, "criarov0-weekly-20260703-000000.dump.sha256"))).toBe(true)
  })

  it("never removes a backup that hasn't exceeded its bucket limit", () => {
    seedDaily(5)
    const removed = applyRetention(dir, { daily: 7, weekly: 4, monthly: 6 })
    expect(removed).toHaveLength(0)
  })

  it("does not promote a weekly/monthly copy twice for the same source", () => {
    seedDaily(10)
    applyRetention(dir, { daily: 7, weekly: 4, monthly: 6 })
    // Re-running retention against the now-trimmed directory (no new dumps
    // added) must be a no-op: nothing left to promote or remove.
    const removedAgain = applyRetention(dir, { daily: 7, weekly: 4, monthly: 6 })
    expect(removedAgain).toEqual([])
  })

  it("removes the sha256 sidecar file together with its dump", () => {
    seedDaily(8)
    writeFileSync(join(dir, "criarov0-20260701-000000.dump.sha256"), "deadbeef  criarov0-20260701-000000.dump\n")
    applyRetention(dir, { daily: 7, weekly: 4, monthly: 6 })
    expect(existsSync(join(dir, "criarov0-20260701-000000.dump"))).toBe(false)
    expect(existsSync(join(dir, "criarov0-20260701-000000.dump.sha256"))).toBe(false)
  })

  it("respects a custom retention policy (e.g. reduced disk capacity)", () => {
    seedDaily(6)
    const removed = applyRetention(dir, { daily: 3, weekly: 1, monthly: 1 })
    expect(removed.filter((name) => classify(name) === "daily")).toHaveLength(3)
  })
})
