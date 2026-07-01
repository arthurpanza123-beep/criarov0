import "server-only"

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm"

import { assertNonNegativeDecimal } from "@/lib/admin/money"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { campaigns, type NewCampaignRow } from "@/lib/db/schema"

export async function listCampaigns(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(campaigns.name, `%${input.q}%`),
          ilike(campaigns.platform, `%${input.q}%`),
        )
      : undefined,
    input.status === "archived" ? isNotNull(campaigns.archivedAt) : isNull(campaigns.archivedAt),
    input.status === "active" ? eq(campaigns.active, true) : undefined,
    input.status === "inactive" ? eq(campaigns.active, false) : undefined,
    input.platform ? eq(campaigns.platform, input.platform) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db.select({ value: count() }).from(campaigns).where(where)
  const data = await db
    .select()
    .from(campaigns)
    .where(where)
    .orderBy(desc(campaigns.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function createCampaign(values: NewCampaignRow) {
  assertNonNegativeDecimal(values.rewardPerConversion ?? "0", "Recompensa")
  const [row] = await getDb().insert(campaigns).values(values).returning()
  return row
}

export async function updateCampaign(id: string, values: Partial<NewCampaignRow>) {
  if (values.rewardPerConversion != null) assertNonNegativeDecimal(values.rewardPerConversion, "Recompensa")
  const [row] = await getDb()
    .update(campaigns)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning()
  return row ?? null
}

export async function archiveCampaign(id: string) {
  const [row] = await getDb()
    .update(campaigns)
    .set({ active: false, archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning()
  return row ?? null
}

export async function restoreCampaign(id: string) {
  const [row] = await getDb()
    .update(campaigns)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(campaigns.id, id))
    .returning()
  return row ?? null
}

export const campaignsService = {
  list: listCampaigns,
  create: createCampaign,
  update: updateCampaign,
  archive: archiveCampaign,
  restore: restoreCampaign,
}
