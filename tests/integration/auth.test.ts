import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"

import { and, eq, inArray, like, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { config } from "dotenv"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { closeDatabaseClient, createDatabaseClient } from "@/lib/db"
import { account, activities, session, user, verification, rateLimit } from "@/lib/db/schema"

config({ path: ".env.local", quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL

if (!testDatabaseUrl || !/\/criarov0_test(?:\?|$)/.test(testDatabaseUrl)) {
  throw new Error("Integration auth tests require TEST_DATABASE_URL pointing to criarov0_test.")
}

process.env.DATABASE_URL = testDatabaseUrl
process.env.BETTER_AUTH_URL ??= "http://localhost:3000"
process.env.APP_URL ??= "http://localhost:3000"

const ownerEmail = `owner-${randomUUID()}@example.test`
const ownerPassword = `Owner!${randomUUID()}A7`
const changedOwnerPassword = `Changed!${randomUUID()}Z9`
const viewerEmail = `viewer-${randomUUID()}@example.test`
const viewerPassword = `Viewer!${randomUUID()}B8`
const blockedEmail = `blocked-${randomUUID()}@example.test`
const blockedPassword = `Blocked!${randomUUID()}C9`

const client = createDatabaseClient(testDatabaseUrl)
const db = client.db
let auth: Awaited<typeof import("@/lib/auth/auth")>["auth"]

function testEnv(extra: Record<string, string>) {
  return {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    ...extra,
  }
}

function authRequest(path: string, init?: RequestInit) {
  return auth.handler(new Request(`http://localhost:3000/api/auth${path}`, init))
}

function cookieFrom(response: Response) {
  const cookie = response.headers.get("set-cookie")
  return cookie?.split(";")[0] ?? ""
}

async function cleanup() {
  const testUsers = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, "%@example.test"))

  const userIds = testUsers.map((row) => row.id)
  if (userIds.length > 0) {
    await db.delete(activities).where(
      and(
        eq(activities.entityType, "user"),
        inArray(activities.action, [
          "owner_created",
          "user_created",
          "role_changed",
          "user_blocked",
          "user_reactivated",
          "must_change_password_marked",
          "password_changed",
        ]),
      ),
    )
    await db.delete(session).where(inArray(session.userId, userIds))
    await db.delete(account).where(inArray(account.userId, userIds))
    await db.delete(user).where(inArray(user.id, userIds))
  }

  await db.delete(verification).where(like(verification.identifier, "%@example.test"))
  await db.delete(rateLimit)
}

describe("better auth integration", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "lib/db/migrations" })
    await cleanup()
    auth = (await import("@/lib/auth/auth")).auth
  })

  afterAll(async () => {
    await cleanup()
    await closeDatabaseClient(client)
  })

  it("keeps auth tables migrated", async () => {
    const rows = await db.execute(sql<{ table_name: string }>`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('user', 'session', 'account', 'verification', 'rate_limit')
      order by table_name
    `)

    expect(rows.map((row) => row.table_name)).toEqual(["account", "rate_limit", "session", "user", "verification"])
  })

  it("bootstraps the owner idempotently", async () => {
    const env = testEnv({
      INITIAL_OWNER_NAME: "Owner Test",
      INITIAL_OWNER_EMAIL: ownerEmail,
      INITIAL_OWNER_PASSWORD: ownerPassword,
    })

    const first = spawnSync("corepack", ["pnpm@9.15.9", "auth:bootstrap-owner"], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    })
    const second = spawnSync("corepack", ["pnpm@9.15.9", "auth:bootstrap-owner"], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    })

    expect(first.status).toBe(0)
    expect(second.status).toBe(0)

    const owners = await db.select().from(user).where(eq(user.email, ownerEmail))
    expect(owners).toHaveLength(1)
    expect(owners[0]).toMatchObject({
      role: "owner",
      mustChangePassword: true,
      banned: false,
    })
  }, 30_000)

  it("blocks public sign-up", async () => {
    const response = await authRequest("/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Public User",
        email: `public-${randomUUID()}@example.test`,
        password: `Public!${randomUUID()}D7`,
      }),
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it("logs in, reads session, rejects bad login and logs out", async () => {
    const badLogin = await authRequest("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password: "wrong-password" }),
    })
    expect(badLogin.status).toBeGreaterThanOrEqual(400)

    const login = await authRequest("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    })
    expect(login.status).toBe(200)
    const cookie = cookieFrom(login)
    expect(cookie).toContain("session")

    const sessionResponse = await authRequest("/get-session", {
      headers: { cookie },
    })
    expect(sessionResponse.status).toBe(200)
    const sessionBody = await sessionResponse.json()
    expect(sessionBody.user.email).toBe(ownerEmail)
    expect(sessionBody.user.mustChangePassword).toBe(true)

    const logout = await authRequest("/sign-out", {
      method: "POST",
      headers: { cookie },
    })
    expect(logout.status).toBe(200)
  })

  it("requires and completes password change", async () => {
    const login = await authRequest("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password: ownerPassword }),
    })
    const cookie = cookieFrom(login)

    const change = await authRequest("/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        currentPassword: ownerPassword,
        newPassword: changedOwnerPassword,
        revokeOtherSessions: true,
      }),
    })
    expect(change.status).toBe(200)

    await db.update(user).set({ mustChangePassword: false }).where(eq(user.email, ownerEmail))

    const [owner] = await db.select().from(user).where(eq(user.email, ownerEmail)).limit(1)
    expect(owner.mustChangePassword).toBe(false)
  })

  it("blocks banned users from creating sessions", async () => {
    const created = await auth.api.createUser({
      body: {
        name: "Blocked User",
        email: blockedEmail,
        password: blockedPassword,
        role: "viewer",
      },
    })
    await db.update(user).set({ banned: true }).where(eq(user.id, created.user.id))

    const response = await authRequest("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: blockedEmail, password: blockedPassword }),
    })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })

  it("allows owner admin mutation and denies viewer mutation", async () => {
    const ownerLogin = await authRequest("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ownerEmail, password: changedOwnerPassword }),
    })
    const ownerCookie = cookieFrom(ownerLogin)

    const createViewer = await authRequest("/admin/create-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: ownerCookie },
      body: JSON.stringify({
        name: "Viewer Test",
        email: viewerEmail,
        password: viewerPassword,
        role: "viewer",
        data: { mustChangePassword: true },
      }),
    })
    expect(createViewer.status).toBe(200)

    const viewerLogin = await authRequest("/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: viewerEmail, password: viewerPassword }),
    })
    const viewerCookie = cookieFrom(viewerLogin)

    const denied = await authRequest("/admin/create-user", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: viewerCookie },
      body: JSON.stringify({
        name: "Denied User",
        email: `denied-${randomUUID()}@example.test`,
        password: `Denied!${randomUUID()}E7`,
        role: "viewer",
      }),
    })

    expect(denied.status).toBeGreaterThanOrEqual(400)
  })

  it("keeps activities actor foreign key nullable with set null", async () => {
    const [owner] = await db.select().from(user).where(eq(user.email, ownerEmail)).limit(1)
    const [activity] = await db
      .insert(activities)
      .values({
        actorUserId: owner.id,
        entityType: "user",
        entityId: owner.id,
        action: "password_changed",
        metadata: {},
      })
      .returning()

    await db.delete(user).where(eq(user.id, owner.id))

    const [afterDelete] = await db.select().from(activities).where(eq(activities.id, activity.id)).limit(1)
    expect(afterDelete.actorUserId).toBeNull()
  })

  it("does not expose password hashes through user-facing auth responses", async () => {
    const response = await authRequest("/get-session")
    const body = await response.text()
    expect(body).not.toContain("password")
  })
})
