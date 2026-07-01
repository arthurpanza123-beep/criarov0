import { sql } from "drizzle-orm"

import { closeDatabaseClient, createDatabaseClient } from "@/lib/db"

export const dynamic = "force-dynamic"

type DatabaseHealthResponse =
  | {
      status: "ok"
      database: "reachable"
      timestamp: string
    }
  | {
      status: "error"
      database: "unreachable"
      timestamp: string
    }

export async function GET() {
  const timestamp = new Date().toISOString()

  try {
    const client = createDatabaseClient()
    try {
      await client.db.execute(sql`select 1`)
    } finally {
      await closeDatabaseClient(client)
    }

    const body: DatabaseHealthResponse = {
      status: "ok",
      database: "reachable",
      timestamp,
    }

    return Response.json(body, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  } catch {
    const body: DatabaseHealthResponse = {
      status: "error",
      database: "unreachable",
      timestamp,
    }

    return Response.json(body, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
      },
    })
  }
}
