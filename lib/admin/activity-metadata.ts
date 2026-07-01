/**
 * Strips sensitive keys from activity metadata before it is persisted or shown.
 * Activities are an audit trail: passwords, secrets, tokens, cookies, sessions,
 * hashes, auth headers and credentials must never be written to the database or
 * surfaced in the UI. Matching is by key name (case-insensitive, substring).
 */
const SENSITIVE_KEY = /password|senha|secret|token|cookie|session|hash|header|authorization|credential|api[_-]?key/i

export function sanitizeActivityMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object") return {}
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !SENSITIVE_KEY.test(key)))
}
