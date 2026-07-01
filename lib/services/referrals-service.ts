import "server-only"

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm"

import { assertNonNegativeDecimal } from "@/lib/admin/money"
import { normalizeEmail, normalizePhone } from "@/lib/admin/normalize"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { assertReferralTransition } from "@/lib/admin/status"
import { getDb } from "@/lib/db"
import { campaigns, referrals, type NewReferralRow } from "@/lib/db/schema"
import type { ReferralStatus } from "@/lib/types"

export async function listReferrals(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(referrals.contactName, `%${input.q}%`),
          ilike(referrals.contactEmail, `%${input.q}%`),
          ilike(referrals.contactPhone, `%${input.q}%`),
          ilike(campaigns.name, `%${input.q}%`),
        )
      : undefined,
    input.status === "archived"
      ? isNotNull(referrals.archivedAt)
      : input.status
        ? eq(referrals.status, input.status as ReferralStatus)
        : isNull(referrals.archivedAt),
    input.campaignId ? eq(referrals.campaignId, input.campaignId) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db
    .select({ value: count() })
    .from(referrals)
    .leftJoin(campaigns, eq(campaigns.id, referrals.campaignId))
    .where(where)
  const data = await db
    .select({
      id: referrals.id,
      campaignId: referrals.campaignId,
      campaignName: campaigns.name,
      contactName: referrals.contactName,
      contactEmail: referrals.contactEmail,
      contactPhone: referrals.contactPhone,
      status: referrals.status,
      expectedReward: referrals.expectedReward,
      approvedReward: referrals.approvedReward,
      invitedAt: referrals.invitedAt,
      convertedAt: referrals.convertedAt,
      archivedAt: referrals.archivedAt,
      createdAt: referrals.createdAt,
      updatedAt: referrals.updatedAt,
    })
    .from(referrals)
    .leftJoin(campaigns, eq(campaigns.id, referrals.campaignId))
    .where(where)
    .orderBy(desc(referrals.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function createReferral(values: NewReferralRow) {
  assertNonNegativeDecimal(values.expectedReward ?? "0", "Recompensa esperada")
  const [row] = await getDb()
    .insert(referrals)
    .values({
      ...values,
      contactEmail: normalizeEmail(values.contactEmail),
      contactPhone: normalizePhone(values.contactPhone),
    })
    .returning()
  return row
}

export async function updateReferral(id: string, values: Partial<NewReferralRow>) {
  if (values.expectedReward != null) assertNonNegativeDecimal(values.expectedReward, "Recompensa esperada")
  if (values.approvedReward != null) assertNonNegativeDecimal(values.approvedReward, "Recompensa aprovada")
  const [row] = await getDb()
    .update(referrals)
    .set({
      ...values,
      contactEmail: values.contactEmail === undefined ? undefined : normalizeEmail(values.contactEmail),
      contactPhone: values.contactPhone === undefined ? undefined : normalizePhone(values.contactPhone),
      updatedAt: new Date(),
    })
    .where(eq(referrals.id, id))
    .returning()
  return row ?? null
}

export async function transitionReferral(id: string, nextStatus: ReferralStatus, administrative = false) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(referrals).where(eq(referrals.id, id)).limit(1)
    if (!current) throw new Error("Indicação não encontrada.")
    assertReferralTransition(current.status, nextStatus, administrative)
    const now = new Date()
    const [row] = await tx
      .update(referrals)
      .set({
        status: nextStatus,
        invitedAt: nextStatus === "invited" && !current.invitedAt ? now : current.invitedAt,
        convertedAt: nextStatus === "approved" && !current.convertedAt ? now : current.convertedAt,
        archivedAt: nextStatus === "archived" ? now : current.archivedAt,
        updatedAt: now,
      })
      .where(eq(referrals.id, id))
      .returning()
    return row
  })
}

export async function approveReferral(id: string, approvedReward: string, administrative = false) {
  assertNonNegativeDecimal(approvedReward, "Recompensa aprovada")
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(referrals).where(eq(referrals.id, id)).limit(1)
    if (!current) throw new Error("Indicação não encontrada.")
    if (current.status === "approved") throw new Error("Indicação já aprovada.")
    assertReferralTransition(current.status, "approved", administrative)
    const now = new Date()
    const [row] = await tx
      .update(referrals)
      .set({
        status: "approved",
        approvedReward,
        convertedAt: current.convertedAt ?? now,
        updatedAt: now,
      })
      .where(eq(referrals.id, id))
      .returning()
    return row
  })
}

export async function archiveReferral(id: string) {
  return transitionReferral(id, "archived", true)
}

export async function restoreReferral(id: string) {
  const [row] = await getDb()
    .update(referrals)
    .set({ status: "pending", archivedAt: null, updatedAt: new Date() })
    .where(eq(referrals.id, id))
    .returning()
  return row ?? null
}

export const referralsService = {
  list: listReferrals,
  create: createReferral,
  update: updateReferral,
  transition: transitionReferral,
  approve: approveReferral,
  archive: archiveReferral,
  restore: restoreReferral,
}
