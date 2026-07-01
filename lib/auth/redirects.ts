const SAFE_PATH_PATTERN = /^\/(?!\/)/

export function sanitizeCallbackUrl(value: string | null | undefined, fallback = "/") {
  if (!value) return fallback

  try {
    const decoded = decodeURIComponent(value)
    if (!SAFE_PATH_PATTERN.test(decoded)) return fallback
    if (decoded.startsWith("/api/auth")) return fallback
    if (decoded.startsWith("/login")) return fallback
    return decoded
  } catch {
    return fallback
  }
}
