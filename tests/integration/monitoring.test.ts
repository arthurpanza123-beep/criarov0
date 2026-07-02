import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { config } from "dotenv"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { closeDatabaseClient, createDatabaseClient } from "@/lib/db"
import { jobRuns, jobs, notifications, settings } from "@/lib/db/schema"
import { enqueueJob } from "@/lib/services/jobs-service"
import { runMonitorAndNotify, runMonitorChecks } from "@/lib/services/monitoring-service"
import { upsertSetting } from "@/lib/services/settings-service"
import { WORKER_HEARTBEAT_KEY } from "@/lib/jobs/worker"

config({ path: ".env.local", quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl || !/\/criarov0_test(?:\?|$)/.test(testDatabaseUrl)) {
  throw new Error("Monitoring integration tests require TEST_DATABASE_URL pointing to criarov0_test.")
}
process.env.DATABASE_URL = testDatabaseUrl

const client = createDatabaseClient(testDatabaseUrl)
const db = client.db

async function cleanup() {
  await db.delete(jobRuns)
  await db.delete(jobs)
  await db.delete(notifications)
  await db.delete(settings)
}

describe("phase 7 monitoring integration (criarov0_test)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "lib/db/migrations" })
    await cleanup()
  })
  beforeEach(async () => {
    await cleanup()
  })
  afterAll(async () => {
    await cleanup()
    await closeDatabaseClient(client)
  })

  describe("worker heartbeat check", () => {
    it("reports critical when the worker never reported a heartbeat", async () => {
      const report = await runMonitorChecks()
      const worker = report.checks.find((check) => check.name === "worker")
      expect(worker?.severity).toBe("critical")
    })

    it("reports ok when the heartbeat is fresh", async () => {
      await upsertSetting(WORKER_HEARTBEAT_KEY, { workerId: "worker-test", at: new Date().toISOString() }, db)
      const report = await runMonitorChecks()
      const worker = report.checks.find((check) => check.name === "worker")
      expect(worker?.severity).toBe("ok")
    })

    it("reports critical when the heartbeat is stale (worker likely crashed)", async () => {
      const staleAt = new Date(Date.now() - 5 * 60_000).toISOString() // 5 minutes old
      await upsertSetting(WORKER_HEARTBEAT_KEY, { workerId: "worker-test", at: staleAt }, db)
      const report = await runMonitorChecks()
      const worker = report.checks.find((check) => check.name === "worker")
      expect(worker?.severity).toBe("critical")
    })
  })

  describe("backup check", () => {
    it("warns when no backup has ever been registered", async () => {
      const report = await runMonitorChecks()
      const backup = report.checks.find((check) => check.name === "backup")
      expect(backup?.severity).toBe("warn")
    })

    it("reports ok for a recent successful backup", async () => {
      await upsertSetting("ops.lastBackupStatus", { status: "ok", finishedAt: new Date().toISOString() }, db)
      const report = await runMonitorChecks()
      const backup = report.checks.find((check) => check.name === "backup")
      expect(backup?.severity).toBe("ok")
    })

    it("reports critical for a backup older than the retention window (delayed)", async () => {
      const oldFinishedAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString() // 30h old
      await upsertSetting("ops.lastBackupStatus", { status: "ok", finishedAt: oldFinishedAt }, db)
      const report = await runMonitorChecks()
      const backup = report.checks.find((check) => check.name === "backup")
      expect(backup?.severity).toBe("critical")
      expect(backup?.message).toContain("atrasado")
    })

    it("reports critical when the last backup run failed", async () => {
      await upsertSetting(
        "ops.lastBackupStatus",
        { status: "failed", error: "pg_dump exited with status 1.", finishedAt: new Date().toISOString() },
        db,
      )
      const report = await runMonitorChecks()
      const backup = report.checks.find((check) => check.name === "backup")
      expect(backup?.severity).toBe("critical")
    })
  })

  describe("dead-letter and queue backlog checks", () => {
    it("flags dead-letter jobs above the warning threshold", async () => {
      await enqueueJob({ type: "maintenance", maxAttempts: 1 }, db)
      await db.update(jobs).set({ status: "dead_letter" })
      const report = await runMonitorChecks()
      const deadLetter = report.checks.find((check) => check.name === "dead_letter")
      expect(deadLetter?.severity).toBe("warn")
    })

    it("reports ok when the queue has no backlog", async () => {
      const report = await runMonitorChecks()
      const backlog = report.checks.find((check) => check.name === "queue_backlog")
      expect(backlog?.severity).toBe("ok")
    })

    it("flags an old pending job as a backlog warning", async () => {
      await enqueueJob({ type: "maintenance", runAt: new Date(Date.now() - 10 * 60_000) }, db)
      const report = await runMonitorChecks()
      const backlog = report.checks.find((check) => check.name === "queue_backlog")
      expect(backlog?.severity).not.toBe("ok")
    })
  })

  describe("stuck jobs check", () => {
    it("flags a job stuck in running past the stale-running window", async () => {
      const job = await enqueueJob({ type: "maintenance" }, db)
      await db
        .update(jobs)
        .set({ status: "running", lockedAt: new Date(Date.now() - 10 * 60_000), lockedBy: "worker-crashed" })
        .where(eq(jobs.id, job.id))
      const report = await runMonitorChecks()
      const stuck = report.checks.find((check) => check.name === "stuck_jobs")
      expect(stuck?.severity).toBe("warn")
    })
  })

  describe("disk check", () => {
    it("always returns a severity without throwing", async () => {
      const report = await runMonitorChecks()
      const disk = report.checks.find((check) => check.name === "disk")
      expect(disk).toBeDefined()
      expect(["ok", "warn", "critical"]).toContain(disk?.severity)
    })
  })

  describe("notification deduplication", () => {
    it("creates exactly one notification for a new incident, none for a repeat run", async () => {
      await runMonitorAndNotify() // worker never reported a heartbeat -> critical incident
      const afterFirst = await db.select().from(notifications)
      expect(afterFirst).toHaveLength(1)

      await runMonitorAndNotify() // same incident, still failing
      const afterSecond = await db.select().from(notifications)
      expect(afterSecond).toHaveLength(1)
    })

    it("creates a recovery notification when the incident clears", async () => {
      await runMonitorAndNotify() // critical: no heartbeat
      await upsertSetting(WORKER_HEARTBEAT_KEY, { workerId: "worker-test", at: new Date().toISOString() }, db)
      await upsertSetting("ops.lastBackupStatus", { status: "ok", finishedAt: new Date().toISOString() }, db)
      await runMonitorAndNotify() // should now be fully healthy
      const rows = await db.select().from(notifications)
      const recovery = rows.find((row) => row.title === "Operação normalizada")
      expect(recovery).toBeDefined()
    })
  })

  describe("severity aggregation", () => {
    it("overall severity is the worst of all individual checks", async () => {
      const report = await runMonitorChecks()
      const worst = report.checks.some((check) => check.severity === "critical")
        ? "critical"
        : report.checks.some((check) => check.severity === "warn")
          ? "warn"
          : "ok"
      expect(report.severity).toBe(worst)
    })
  })
})
