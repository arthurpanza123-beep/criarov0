import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

import { closeDatabaseClient } from "@/lib/db"
import { runWorker } from "@/lib/jobs/worker"
import { logger } from "@/lib/observability/logger"

async function main() {
  await runWorker({
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS) || 2_000,
  })
}

main()
  .then(async () => {
    await closeDatabaseClient().catch(() => {})
    process.exit(0)
  })
  .catch(async (error: unknown) => {
    logger.error("worker crashed", { error: error instanceof Error ? error.message : String(error) })
    await closeDatabaseClient().catch(() => {})
    process.exit(1)
  })
