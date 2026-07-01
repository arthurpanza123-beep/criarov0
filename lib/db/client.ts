import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

import * as schema from "@/lib/db/schema"

type DbClient = ReturnType<typeof createDatabaseClient>

declare global {
  var __v0FarmDbClient: DbClient | undefined
}

function readDatabaseUrl(databaseUrl?: string) {
  const value = databaseUrl ?? process.env.DATABASE_URL
  if (!value) {
    throw new Error("DATABASE_URL is required for database access.")
  }
  return value
}

export function createDatabaseClient(databaseUrl?: string) {
  const sql = postgres(readDatabaseUrl(databaseUrl), {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  })

  return {
    sql,
    db: drizzle(sql, { schema }),
  }
}

export function getDatabaseClient() {
  if (process.env.NODE_ENV === "production") {
    return createDatabaseClient()
  }

  globalThis.__v0FarmDbClient ??= createDatabaseClient()
  return globalThis.__v0FarmDbClient
}

export function getDb() {
  return getDatabaseClient().db
}

export async function closeDatabaseClient(client = getDatabaseClient()) {
  await client.sql.end()
}
