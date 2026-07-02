/**
 * Minimal structured JSON logger with sensitive-data sanitization. No external
 * dependencies. Safe to use in server components, Server Actions, API routes and
 * the worker. Never logs raw secrets, tokens, cookies, passwords or DB URLs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function minLevel(): LogLevel {
  const value = (process.env.LOG_LEVEL ?? "").toLowerCase()
  return value in LEVELS ? (value as LogLevel) : "info"
}

const SENSITIVE_KEY =
  /pass(word)?|senha|secret|token|cookie|session|authorization|credential|api[_-]?key|hash|database[_-]?url|connection[_-]?string|dsn/i

const CONNECTION_STRING = /\b[a-z]+(?:ql)?:\/\/[^\s"']*:[^\s"'@]*@[^\s"']+/gi

export function sanitizeLogValue(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]"
  if (value === null || value === undefined) return value
  if (typeof value === "string") return value.replace(CONNECTION_STRING, "[redacted-connection]")
  if (typeof value === "bigint") return value.toString()
  if (typeof value !== "object") return value
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeLogValue(item, depth + 1))
  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    output[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitizeLogValue(item, depth + 1)
  }
  return output
}

export type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void
  info: (message: string, context?: Record<string, unknown>) => void
  warn: (message: string, context?: Record<string, unknown>) => void
  error: (message: string, context?: Record<string, unknown>) => void
  child: (bindings: Record<string, unknown>) => Logger
}

export function createLogger(base: Record<string, unknown> = {}): Logger {
  function emit(level: LogLevel, message: string, context?: Record<string, unknown>) {
    if (LEVELS[level] < LEVELS[minLevel()]) return
    const merged = sanitizeLogValue({ ...base, ...context }) as Record<string, unknown>
    const entry = { level, time: new Date().toISOString(), message, ...merged }
    const line = JSON.stringify(entry)
    if (level === "error") console.error(line)
    else if (level === "warn") console.warn(line)
    else console.log(line)
  }
  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
    child: (bindings) => createLogger({ ...base, ...bindings }),
  }
}

export const logger = createLogger({ service: "v0-farm-console" })
