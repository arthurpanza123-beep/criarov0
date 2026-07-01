import "server-only"

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm"

import { normalizeEmail, normalizePhone } from "@/lib/admin/normalize"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { customers, type NewCustomerRow } from "@/lib/db/schema"

export async function listCustomers(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(customers.name, `%${input.q}%`),
          ilike(customers.email, `%${input.q}%`),
          ilike(customers.phone, `%${input.q}%`),
        )
      : undefined,
    input.status === "archived" ? isNotNull(customers.archivedAt) : isNull(customers.archivedAt),
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db.select({ value: count() }).from(customers).where(where)
  const data = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function createCustomer(values: NewCustomerRow) {
  const [row] = await getDb()
    .insert(customers)
    .values({ ...values, email: normalizeEmail(values.email), phone: normalizePhone(values.phone) })
    .returning()
  return row
}

export async function updateCustomer(id: string, values: Partial<NewCustomerRow>) {
  const [row] = await getDb()
    .update(customers)
    .set({
      ...values,
      email: values.email === undefined ? undefined : normalizeEmail(values.email),
      phone: values.phone === undefined ? undefined : normalizePhone(values.phone),
      updatedAt: new Date(),
    })
    .where(eq(customers.id, id))
    .returning()
  return row ?? null
}

export async function archiveCustomer(id: string) {
  const [row] = await getDb()
    .update(customers)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning()
  return row ?? null
}

export async function restoreCustomer(id: string) {
  const [row] = await getDb()
    .update(customers)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning()
  return row ?? null
}

export const customersService = {
  list: listCustomers,
  create: createCustomer,
  update: updateCustomer,
  archive: archiveCustomer,
  restore: restoreCustomer,
}
