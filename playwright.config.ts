import { config as loadEnv } from "dotenv"
import { defineConfig, devices } from "@playwright/test"

loadEnv({ path: ".env.local", quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl || !/\/criarov0_test(?:\?|$)/.test(testDatabaseUrl)) {
  throw new Error("Playwright E2E requires TEST_DATABASE_URL pointing to criarov0_test.")
}

const PORT = Number(process.env.E2E_PORT) || 4319
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    actionTimeout: 20_000,
    navigationTimeout: 90_000,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node_modules/.bin/next build && node_modules/.bin/next start -p ${PORT} -H 127.0.0.1`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: testDatabaseUrl,
      APP_URL: baseURL,
      BETTER_AUTH_URL: baseURL,
      NODE_ENV: "production",
    },
  },
})
