export type PaginationInput = {
  limit?: number
  offset?: number
}

export function normalizePagination(input: PaginationInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)
  return { limit, offset }
}

export function normalizeEmail(email: string | null | undefined) {
  return email ? email.trim().toLowerCase() : email
}
