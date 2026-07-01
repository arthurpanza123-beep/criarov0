export type ListSearchParams = {
  page?: string
  pageSize?: string
  q?: string
  status?: string
  type?: string
  provider?: string
  platform?: string
  accountId?: string
  campaignId?: string
  from?: string
  to?: string
  unread?: string
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListParams = {
  page: number
  pageSize: number
  offset: number
  q?: string
  status?: string
  type?: string
  provider?: string
  platform?: string
  accountId?: string
  campaignId?: string
  from?: Date
  to?: Date
  unread?: boolean
}

export function normalizeListParams(params: ListSearchParams = {}): ListParams {
  const pageSize = Math.min(Math.max(Number(params.pageSize) || 20, 1), 100)
  const page = Math.max(Number(params.page) || 1, 1)
  const from = params.from ? new Date(params.from) : undefined
  const to = params.to ? new Date(params.to) : undefined

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    q: normalizeText(params.q),
    status: normalizeText(params.status),
    type: normalizeText(params.type),
    provider: normalizeText(params.provider),
    platform: normalizeText(params.platform),
    accountId: normalizeText(params.accountId),
    campaignId: normalizeText(params.campaignId),
    from: from && Number.isFinite(from.getTime()) ? from : undefined,
    to: to && Number.isFinite(to.getTime()) ? to : undefined,
    unread: params.unread === "true" ? true : params.unread === "false" ? false : undefined,
  }
}

export function makePaginatedResult<T>(
  data: T[],
  total: number,
  params: Pick<ListParams, "page" | "pageSize">,
): PaginatedResult<T> {
  return {
    data,
    total,
    page: params.page,
    pageSize: params.pageSize,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  }
}

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
