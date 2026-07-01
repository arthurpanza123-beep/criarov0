import { config } from "dotenv"

import { closeDatabaseClient, createDatabaseClient } from "@/lib/db/client"
import { settingsService } from "@/lib/services/settings-service"

config({ path: ".env.local", quiet: true })

const seedSettings = [
  { key: "app.currency", value: "USD" },
  { key: "app.locale", value: "pt-BR" },
  { key: "app.timezone", value: "America/Sao_Paulo" },
  { key: "app.defaultMonthlyLimit", value: 200 },
  { key: "app.schemaVersion", value: 1 },
] as const

async function main() {
  const client = createDatabaseClient(process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL)

  try {
    for (const setting of seedSettings) {
      await settingsService.upsert(setting.key, setting.value, client.db)
    }
  } finally {
    await closeDatabaseClient(client)
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown seed error"
  console.error(`Seed failed: ${message}`)
  process.exit(1)
})
