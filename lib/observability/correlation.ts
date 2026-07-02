import { randomUUID } from "node:crypto"

export const CORRELATION_HEADER = "x-correlation-id"

export function newCorrelationId(): string {
  return randomUUID()
}

/** Reads a correlation id from request headers or generates a fresh one. */
export function correlationIdFromHeaders(headers?: Headers | null): string {
  const existing = headers?.get(CORRELATION_HEADER)?.trim()
  if (existing && existing.length <= 128) return existing
  return newCorrelationId()
}
