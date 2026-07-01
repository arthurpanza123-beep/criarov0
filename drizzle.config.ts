import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

const databaseUrl = process.env.DRIZZLE_DATABASE_URL ?? process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run Drizzle commands.")
}

export default defineConfig({
  schema: "./lib/db/schema/index.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: false,
})
