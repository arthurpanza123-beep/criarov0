import { config } from "dotenv"
import { assertStrongPassword } from "@/lib/auth/password"

config({ path: ".env.local", quiet: true })

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@")
  return `${local.slice(0, 2)}***@${domain}`
}

async function main() {
  const [{ eq }, { auth }, { closeDatabaseClient, getDatabaseClient }, { activities, user }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/auth/auth"),
    import("@/lib/db"),
    import("@/lib/db/schema"),
  ])

  const name = requiredEnv("INITIAL_OWNER_NAME")
  const email = requiredEnv("INITIAL_OWNER_EMAIL").toLowerCase()
  const password = requiredEnv("INITIAL_OWNER_PASSWORD")

  assertStrongPassword(password)

  const client = getDatabaseClient()
  try {
    const [existingOwner] = await client.db.select().from(user).where(eq(user.role, "owner")).limit(1)
    if (existingOwner) {
      console.log(`Owner already exists: ${maskEmail(existingOwner.email)}`)
      return
    }

    const created = await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role: "owner",
        data: {
          mustChangePassword: true,
          banned: false,
        },
      },
    })

    await client.db.insert(activities).values({
      actorUserId: created.user.id,
      entityType: "user",
      entityId: created.user.id,
      action: "owner_created",
      metadata: {
        role: "owner",
        mustChangePassword: true,
      },
    })

    console.log(`Owner created: ${maskEmail(created.user.email)}`)
  } finally {
    await closeDatabaseClient(client)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to bootstrap owner.")
  process.exit(1)
})
