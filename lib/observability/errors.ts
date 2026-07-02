import { sanitizeLogValue } from "@/lib/observability/logger"

/**
 * Returns a user/log-safe error message. Never includes a stack trace, and
 * redacts connection strings. Falls back to a generic message.
 */
export function safeErrorMessage(error: unknown, fallback = "Erro interno."): string {
  if (error instanceof Error && typeof error.message === "string" && error.message.trim()) {
    return String(sanitizeLogValue(error.message))
  }
  if (typeof error === "string" && error.trim()) {
    return String(sanitizeLogValue(error))
  }
  return fallback
}
