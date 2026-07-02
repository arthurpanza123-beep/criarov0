import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

import { eq, inArray, like } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"

import { auth } from "@/lib/auth/auth"
import { closeDatabaseClient, createDatabaseClient } from "@/lib/db/client"
import * as schema from "@/lib/db/schema"
import { E2E_PASSWORD, E2E_USERS } from "@/tests/e2e/users"

type Db = ReturnType<typeof createDatabaseClient>["db"]

const url = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL
if (!url || !/\/criarov0_test(?:\?|$)/.test(url)) {
  console.error("e2e-db: TEST_DATABASE_URL must point to criarov0_test.")
  process.exit(1)
}

const { account, session, user, rateLimit } = schema

async function removeE2EUsers(db: Db) {
  const existing = await db.select({ id: user.id }).from(user).where(like(user.email, "%@e2e.local"))
  const ids = existing.map((row) => row.id)
  if (ids.length > 0) {
    await db.delete(session).where(inArray(session.userId, ids))
    await db.delete(account).where(inArray(account.userId, ids))
    await db.delete(user).where(inArray(user.id, ids))
  }
}

async function setup(db: Db) {
  await migrate(db, { migrationsFolder: "lib/db/migrations" })
  await removeE2EUsers(db)
  await db.delete(rateLimit)
  for (const seed of E2E_USERS) {
    await auth.api.createUser({ body: { name: seed.name, email: seed.email, password: E2E_PASSWORD, role: seed.role } })
    await db.update(user).set({ role: seed.role, mustChangePassword: false, banned: false }).where(eq(user.email, seed.email))
  }
}

async function teardown(db: Db) {
  await db.delete(schema.jobRuns)
  await db.delete(schema.jobs)
  await db.delete(schema.importBatches)
  await db.delete(schema.creditLedger)
  await db.delete(schema.orders)
  await db.delete(schema.referrals)
  await db.delete(schema.managedAccounts)
  await db.delete(schema.campaigns)
  await db.delete(schema.customers)
  await db.delete(schema.notifications)
  await removeE2EUsers(db)
}

async function main() {
  const mode = process.argv[2]
  process.env.DATABASE_URL = url
  const client = createDatabaseClient(url)
  try {
    if (mode === "setup") await setup(client.db)
    else if (mode === "teardown") await teardown(client.db)
    else throw new Error(`e2e-db: unknown mode "${mode}" (use setup|teardown).`)
  } finally {
    await closeDatabaseClient(client)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("e2e-db failed:", error instanceof Error ? error.message : error)
    process.exit(1)
  })
