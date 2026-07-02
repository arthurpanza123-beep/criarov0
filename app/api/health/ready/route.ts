import { sql } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { queueHealth } from "@/lib/services/jobs-service"

export const dynamic = "force-dynamic"

export async function GET() {
  const checks: Record<string, "ok" | "error"> = { database: "ok", queue: "ok" }
  let queue: { pending: number; running: number; deadLetter: number; oldestPendingMs: number } | null = null

  try {
    await getDb().execute(sql`select 1`)
  } catch {
    checks.database = "error"
  }

  try {
    const health = await queueHealth()
    queue = {
      pending: health.pending,
      running: health.running,
      deadLetter: health.deadLetter,
      oldestPendingMs: health.oldestPendingMs,
    }
  } catch {
    checks.queue = "error"
  }

  const ready = checks.database === "ok" && checks.queue === "ok"
  return Response.json(
    { status: ready ? "ready" : "degraded", checks, queue, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  )
}
