import { spawnSync } from "node:child_process"

import { config as loadEnv } from "dotenv"

// Seeds the four RBAC users into criarov0_test via a tsx subprocess (which
// resolves the "@/" alias and the schema barrel reliably). Never runs against
// anything other than criarov0_test.
export default async function globalSetup() {
  loadEnv({ path: ".env.local", quiet: true })
  const url = process.env.TEST_DATABASE_URL
  if (!url || !/\/criarov0_test(?:\?|$)/.test(url)) {
    throw new Error("Playwright E2E requires TEST_DATABASE_URL pointing to criarov0_test.")
  }
  const port = process.env.E2E_PORT || "4319"
  const result = spawnSync("node", ["--import", "tsx", "scripts/e2e-db.ts", "setup"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
      APP_URL: `http://127.0.0.1:${port}`,
    },
  })
  if (result.status !== 0) {
    throw new Error("E2E global setup failed while seeding the test database.")
  }
}
