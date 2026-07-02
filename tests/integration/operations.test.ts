import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { config } from "dotenv"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { GET as readyRoute } from "@/app/api/health/ready/route"
import { GET as versionRoute } from "@/app/api/version/route"
import { can } from "@/lib/auth/permissions"
import { closeDatabaseClient, createDatabaseClient } from "@/lib/db"
import {
  campaigns,
  creditLedger,
  customers,
  importBatches,
  jobRuns,
  jobs,
  managedAccounts,
  notifications,
  orders,
  referrals,
} from "@/lib/db/schema"
import { runClaimedJob, runQueueOnce } from "@/lib/jobs/worker"
import { exportEntityCsv } from "@/lib/services/export-service"
import { runImport } from "@/lib/services/import-service"
import {
  cancelJob,
  claimNextJob,
  completeJob,
  enqueueJob,
  failJob,
  getJob,
  listJobRuns,
  retryJob,
} from "@/lib/services/jobs-service"

config({ path: ".env.local", quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl || !/\/criarov0_test(?:\?|$)/.test(testDatabaseUrl)) {
  throw new Error("Operations integration tests require TEST_DATABASE_URL pointing to criarov0_test.")
}
process.env.DATABASE_URL = testDatabaseUrl

const client = createDatabaseClient(testDatabaseUrl)
const db = client.db

async function cleanup() {
  await db.delete(jobRuns)
  await db.delete(jobs)
  await db.delete(importBatches)
  await db.delete(creditLedger)
  await db.delete(orders)
  await db.delete(referrals)
  await db.delete(managedAccounts)
  await db.delete(campaigns)
  await db.delete(customers)
  await db.delete(notifications)
}

describe("phase 6 operations integration (criarov0_test)", () => {
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

  describe("queue lifecycle", () => {
    it("enqueues, claims and completes a job", async () => {
      const job = await enqueueJob({ type: "generate_notification", payload: { title: "t", message: "m" } }, db)
      expect(job.status).toBe("pending")

      const claimed = await claimNextJob("worker-a", db)
      expect(claimed?.id).toBe(job.id)
      expect(claimed?.status).toBe("running")
      expect(claimed?.attempts).toBe(1)

      const done = await completeJob(job.id, { ok: true }, db)
      expect(done?.status).toBe("completed")
      expect(done?.lockedAt).toBeNull()
    })

    it("retries with backoff, then dead-letters after max attempts", async () => {
      const job = await enqueueJob({ type: "maintenance", maxAttempts: 2 }, db)

      const first = await claimNextJob("worker-a", db)
      expect(first?.attempts).toBe(1)
      const afterFail = await failJob(job.id, "boom", db)
      expect(afterFail?.status).toBe("pending")
      expect(new Date(afterFail!.runAt).getTime()).toBeGreaterThan(Date.now()) // scheduled into the future (backoff)

      // Not claimable yet because runAt is in the future.
      expect(await claimNextJob("worker-a", db)).toBeNull()

      // Force it runnable and exhaust the last attempt.
      await db.update(jobs).set({ runAt: new Date(Date.now() - 1000) }).where(eq(jobs.id, job.id))
      const second = await claimNextJob("worker-a", db)
      expect(second?.attempts).toBe(2)
      const dead = await failJob(job.id, "boom again", db)
      expect(dead?.status).toBe("dead_letter")
    })

    it("prevents two workers from claiming the same job (SKIP LOCKED)", async () => {
      await enqueueJob({ type: "maintenance" }, db)
      await enqueueJob({ type: "maintenance" }, db)
      const [a, b] = await Promise.all([claimNextJob("worker-a", db), claimNextJob("worker-b", db)])
      expect(a).not.toBeNull()
      expect(b).not.toBeNull()
      expect(new Set([a!.id, b!.id]).size).toBe(2)
    })

    it("is idempotent for a given idempotency key", async () => {
      const key = `recon:${randomUUID()}`
      const first = await enqueueJob({ type: "maintenance", idempotencyKey: key }, db)
      const second = await enqueueJob({ type: "maintenance", idempotencyKey: key }, db)
      expect(second.id).toBe(first.id)
      const rows = await db.select().from(jobs).where(eq(jobs.idempotencyKey, key))
      expect(rows).toHaveLength(1)
    })

    it("cancels a pending job but not a running one", async () => {
      const pending = await enqueueJob({ type: "maintenance" }, db)
      const cancelled = await cancelJob(pending.id, db)
      expect(cancelled?.status).toBe("cancelled")

      const running = await enqueueJob({ type: "maintenance" }, db)
      await claimNextJob("worker-a", db)
      const blocked = await cancelJob(running.id, db)
      expect(blocked).toBeNull()
    })

    it("manually retries a dead-letter job with fresh attempts", async () => {
      const job = await enqueueJob({ type: "maintenance", maxAttempts: 1 }, db)
      await claimNextJob("worker-a", db)
      await failJob(job.id, "boom", db)
      const dead = await getJob(job.id, db)
      expect(dead?.status).toBe("dead_letter")

      const retried = await retryJob(job.id, db)
      expect(retried?.status).toBe("pending")
      expect(retried?.attempts).toBe(0)
    })

    it("reclaims a stale lock left by a crashed worker once its timeout has elapsed", async () => {
      const job = await enqueueJob({ type: "maintenance", timeoutMs: 1000, maxAttempts: 3 }, db)
      const claimed = await claimNextJob("worker-crashed", db)
      expect(claimed?.status).toBe("running")

      // Not reclaimable yet: locked_at is fresh and within timeout_ms.
      expect(await claimNextJob("worker-b", db)).toBeNull()

      // Simulate the crash: push locked_at into the past beyond timeout_ms.
      await db
        .update(jobs)
        .set({ lockedAt: new Date(Date.now() - 5000) })
        .where(eq(jobs.id, job.id))

      const reclaimed = await claimNextJob("worker-b", db)
      expect(reclaimed?.id).toBe(job.id)
      expect(reclaimed?.lockedBy).toBe("worker-b")
      expect(reclaimed?.attempts).toBe(2)
    })

    it("does not reclaim a stale-locked job that already exhausted its attempts", async () => {
      const job = await enqueueJob({ type: "maintenance", timeoutMs: 1000, maxAttempts: 1 }, db)
      await claimNextJob("worker-crashed", db)
      await db
        .update(jobs)
        .set({ lockedAt: new Date(Date.now() - 5000) })
        .where(eq(jobs.id, job.id))

      expect(await claimNextJob("worker-b", db)).toBeNull()
    })
  })

  describe("worker execution", () => {
    it("runs a notification job to completion and records the run", async () => {
      const job = await enqueueJob({ type: "generate_notification", payload: { title: "Aviso", message: "corpo", type: "info" } }, db)
      const processed = await runQueueOnce("worker-test", 10)
      expect(processed).toBeGreaterThanOrEqual(1)

      const done = await getJob(job.id, db)
      expect(done?.status).toBe("completed")
      const runs = await listJobRuns(job.id, db)
      expect(runs[0]?.status).toBe("completed")
      const [note] = await db.select().from(notifications).where(eq(notifications.title, "Aviso"))
      expect(note?.message).toBe("corpo")
    })

    it("dead-letters a failing job and records a sanitized error", async () => {
      const job = await enqueueJob({ type: "reconcile_account", payload: { managedAccountId: randomUUID() }, maxAttempts: 1 }, db)
      await runQueueOnce("worker-test", 10)
      const done = await getJob(job.id, db)
      expect(done?.status).toBe("dead_letter")
      expect(done?.error).toBeTruthy()
      const runs = await listJobRuns(job.id, db)
      expect(runs[0]?.status).toBe("failed")
    })

    it("times out a job that exceeds its timeoutMs and records a timeout run", async () => {
      const job = await enqueueJob(
        { type: "reconcile_account", payload: { managedAccountId: randomUUID() }, timeoutMs: 1000, maxAttempts: 1 },
        db,
      )
      const claimed = await claimNextJob("worker-timeout", db)
      expect(claimed).not.toBeNull()
      const outcome = await runClaimedJob({ ...claimed!, timeoutMs: 1 }, "worker-timeout")
      expect(outcome).toBe("failed")
      const runs = await listJobRuns(job.id, db)
      expect(runs[0]?.status).toBe("timeout")
      const finished = await getJob(job.id, db)
      expect(finished?.status).toBe("dead_letter")
      expect(finished?.error).toContain("timeout")
    })
  })

  describe("import", () => {
    const csv = "label,email,provider,monthlyCreditLimit,notes\nConta Um,UM@Example.com,Plataforma,100.00,nota\nConta Dois,dois@example.com,Plataforma,50,\n"

    it("dry-run validates without inserting", async () => {
      const result = await runImport("managed_accounts", csv, { dryRun: true })
      expect(result.batch.status).toBe("dry_run")
      expect(result.report.validRows).toBe(2)
      expect(result.imported).toBe(0)
      const rows = await db.select().from(managedAccounts)
      expect(rows).toHaveLength(0)
    })

    it("commits transactionally and dedups on re-import", async () => {
      const first = await runImport("managed_accounts", csv, { dryRun: false })
      expect(first.batch.status).toBe("imported")
      expect(first.imported).toBe(2)
      expect((await db.select().from(managedAccounts)).length).toBe(2)

      const second = await runImport("managed_accounts", csv, { dryRun: false })
      expect(second.imported).toBe(0)
      expect(second.report.duplicateRows).toBe(2)
      expect((await db.select().from(managedAccounts)).length).toBe(2)
    })

    it("flags invalid rows", async () => {
      const bad = "label,email,provider,monthlyCreditLimit,notes\nSem Email,not-an-email,Plataforma,10,\n"
      const result = await runImport("managed_accounts", bad, { dryRun: true })
      expect(result.report.invalidRows).toBe(1)
      expect(result.report.validRows).toBe(0)
    })
  })

  describe("transactional rollback", () => {
    it("rolls back all inserts when the transaction throws", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(managedAccounts).values({ label: "Rollback", email: "rollback@example.com", provider: "P" })
          throw new Error("forced failure")
        }),
      ).rejects.toThrow("forced failure")
      const rows = await db.select().from(managedAccounts).where(eq(managedAccounts.email, "rollback@example.com"))
      expect(rows).toHaveLength(0)
    })
  })

  describe("export", () => {
    it("exports managed accounts as CSV", async () => {
      await db.insert(managedAccounts).values({ label: "Export Me", email: "export@example.com", provider: "P", monthlyCreditLimit: "12.00" })
      const csvOut = await exportEntityCsv("managed_accounts", db)
      expect(csvOut.split("\r\n")[0]).toContain("email")
      expect(csvOut).toContain("export@example.com")
    })
  })

  describe("observability endpoints", () => {
    it("readiness reports ready when the database and queue are reachable", async () => {
      const response = await readyRoute()
      const body = await response.json()
      expect(response.status).toBe(200)
      expect(body.status).toBe("ready")
      expect(body.checks.database).toBe("ok")
      expect(body.checks.queue).toBe("ok")
      expect(response.headers.get("Cache-Control")).toBe("no-store")
    })

    it("version endpoint returns version and commit without secrets", () => {
      const response = versionRoute()
      expect(response.status).toBe(200)
    })
  })

  describe("operations rbac", () => {
    it("gates jobs, imports, reports and system by role", () => {
      expect(can("owner", "jobs", "manage")).toBe(true)
      expect(can("owner", "system", "manage")).toBe(true)
      expect(can("admin", "jobs", "manage")).toBe(true)
      expect(can("admin", "imports", "create")).toBe(true)
      expect(can("admin", "system", "read")).toBe(true)
      expect(can("admin", "system", "manage")).toBe(false)
      expect(can("operator", "jobs", "read")).toBe(true)
      expect(can("operator", "jobs", "create")).toBe(false)
      expect(can("operator", "imports", "read")).toBe(false)
      expect(can("viewer", "reports", "read")).toBe(true)
      expect(can("viewer", "jobs", "create")).toBe(false)
      expect(can("viewer", "imports", "read")).toBe(false)
      expect(can("viewer", "system", "read")).toBe(false)
    })
  })
})
