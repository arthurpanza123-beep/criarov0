import { config } from "dotenv"

config({ path: ".env.local", quiet: true })

import { closeDatabaseClient } from "@/lib/db"
import { logger as baseLogger } from "@/lib/observability/logger"
import { runMonitorAndNotify } from "@/lib/services/monitoring-service"

const logger = baseLogger.child({ script: "health-monitor" })
const WEB_URL = process.env.MONITOR_WEB_URL?.trim() || "http://127.0.0.1:3200/api/health"
const WEB_TIMEOUT_MS = 5_000

/**
 * Checks the web process independently of the DB-backed checks (readiness,
 * queue, etc.), since a fully offline web process would otherwise just look
 * like "no data" rather than a specific, actionable failure.
 */
async function checkWebProcess(): Promise<{ ok: boolean; detail: string }> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WEB_TIMEOUT_MS)
    const response = await fetch(WEB_URL, { signal: controller.signal })
    clearTimeout(timer)
    return { ok: response.ok, detail: `HTTP ${response.status}` }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : "unreachable" }
  }
}

async function main() {
  const web = await checkWebProcess()
  if (!web.ok) {
    logger.error("web process check failed", { detail: web.detail, url: WEB_URL })
  } else {
    logger.info("web process check ok", { detail: web.detail })
  }

  const report = await runMonitorAndNotify()
  logger.info("monitor run completed", {
    severity: report.severity,
    checks: report.checks.map((check) => ({ name: check.name, severity: check.severity })),
  })

  // Exit code reflects the worst signal so the systemd unit/journal shows a
  // clear failure without needing to parse log lines.
  if (!web.ok || report.severity === "critical") return 2
  if (report.severity === "warn") return 1
  return 0
}

main()
  .then(async (code) => {
    await closeDatabaseClient().catch(() => {})
    process.exit(code)
  })
  .catch(async (error: unknown) => {
    logger.error("monitor run crashed", { error: error instanceof Error ? error.message : String(error) })
    await closeDatabaseClient().catch(() => {})
    process.exit(2)
  })
