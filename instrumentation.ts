/**
 * Next.js instrumentation hook: runs once when the server process starts
 * (before it accepts requests). Used only to log the running version/commit
 * for operational visibility — never touches request handling or secrets.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { logger } = await import("@/lib/observability/logger")
  const { versionInfo } = await import("@/lib/observability/version")
  logger.info("web server started", versionInfo())
}
