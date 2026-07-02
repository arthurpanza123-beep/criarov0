import { spawnSync } from "node:child_process"

import { config as loadEnv } from "dotenv"

export default async function globalTeardown() {
  loadEnv({ path: ".env.local", quiet: true })
  const url = process.env.TEST_DATABASE_URL
  if (!url || !/\/criarov0_test(?:\?|$)/.test(url)) return
  spawnSync("node", ["--import", "tsx", "scripts/e2e-db.ts", "teardown"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  })
}
