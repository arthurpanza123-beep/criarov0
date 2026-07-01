import "server-only"

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm"

import { assertNonNegativeDecimal } from "@/lib/admin/money"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { managedAccounts, type NewManagedAccountRow } from "@/lib/db/schema"
import { normalizeRequiredEmail } from "@/lib/admin/normalize"

export async function listManagedAccounts(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(managedAccounts.label, `%${input.q}%`),
          ilike(managedAccounts.email, `%${input.q}%`),
          ilike(managedAccounts.provider, `%${input.q}%`),
        )
      : undefined,
    input.status === "archived"
      ? isNotNull(managedAccounts.archivedAt)
      : input.status
        ? eq(managedAccounts.status, input.status as "active" | "inactive" | "suspended" | "archived")
        : isNull(managedAccounts.archivedAt),
    input.provider ? eq(managedAccounts.provider, input.provider) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db.select({ value: count() }).from(managedAccounts).where(where)
  const data = await db
    .select({
      id: managedAccounts.id,
      label: managedAccounts.label,
      email: managedAccounts.email,
      provider: managedAccounts.provider,
      status: managedAccounts.status,
      creditBalance: managedAccounts.creditBalance,
      monthlyCreditLimit: managedAccounts.monthlyCreditLimit,
      notes: managedAccounts.notes,
      lastCheckedAt: managedAccounts.lastCheckedAt,
      archivedAt: managedAccounts.archivedAt,
      createdAt: managedAccounts.createdAt,
      updatedAt: managedAccounts.updatedAt,
    })
    .from(managedAccounts)
    .where(where)
    .orderBy(desc(managedAccounts.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function getManagedAccount(id: string) {
  const [row] = await getDb().select().from(managedAccounts).where(eq(managedAccounts.id, id)).limit(1)
  return row ?? null
}

export async function createManagedAccount(values: NewManagedAccountRow) {
  assertNonNegativeDecimal(values.monthlyCreditLimit ?? "0", "Limite mensal")
  const [row] = await getDb()
    .insert(managedAccounts)
    .values({
      ...values,
      email: normalizeRequiredEmail(values.email),
      creditBalance: "0",
    })
    .returning()
  return row
}

export async function updateManagedAccount(id: string, values: Partial<NewManagedAccountRow>) {
  if (values.monthlyCreditLimit != null) assertNonNegativeDecimal(values.monthlyCreditLimit, "Limite mensal")
  const [row] = await getDb()
    .update(managedAccounts)
    .set({
      ...values,
      email: values.email ? normalizeRequiredEmail(values.email) : undefined,
      creditBalance: undefined,
      updatedAt: new Date(),
    })
    .where(eq(managedAccounts.id, id))
    .returning()
  return row ?? null
}

export async function archiveManagedAccount(id: string) {
  const [row] = await getDb()
    .update(managedAccounts)
    .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(managedAccounts.id, id))
    .returning()
  return row ?? null
}

export async function restoreManagedAccount(id: string) {
  const [row] = await getDb()
    .update(managedAccounts)
    .set({ status: "active", archivedAt: null, updatedAt: new Date() })
    .where(eq(managedAccounts.id, id))
    .returning()
  return row ?? null
}

export const managedAccountsService = {
  list: listManagedAccounts,
  findById: getManagedAccount,
  create: createManagedAccount,
  update: updateManagedAccount,
  archive: archiveManagedAccount,
  restore: restoreManagedAccount,
}
