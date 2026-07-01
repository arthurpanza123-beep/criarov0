import "server-only"

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm"

import { assertNonNegativeDecimal } from "@/lib/admin/money"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { assertOrderTransition } from "@/lib/admin/status"
import { getDb } from "@/lib/db"
import { customers, orders, type NewOrderRow } from "@/lib/db/schema"
import type { OrderStatus } from "@/lib/types"

export async function listOrders(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(orders.description, `%${input.q}%`),
          ilike(customers.name, `%${input.q}%`),
          ilike(customers.email, `%${input.q}%`),
        )
      : undefined,
    input.status === "archived"
      ? isNotNull(orders.archivedAt)
      : input.status
        ? eq(orders.status, input.status as OrderStatus)
        : isNull(orders.archivedAt),
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db
    .select({ value: count() })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(where)
  const data = await db
    .select({
      id: orders.id,
      customerId: orders.customerId,
      customerName: customers.name,
      description: orders.description,
      creditAmount: orders.creditAmount,
      salePrice: orders.salePrice,
      costPrice: orders.costPrice,
      currency: orders.currency,
      status: orders.status,
      paidAt: orders.paidAt,
      deliveredAt: orders.deliveredAt,
      archivedAt: orders.archivedAt,
      createdAt: orders.createdAt,
      updatedAt: orders.updatedAt,
    })
    .from(orders)
    .leftJoin(customers, eq(customers.id, orders.customerId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function createOrder(values: NewOrderRow) {
  assertNonNegativeDecimal(values.creditAmount ?? "0", "Créditos")
  assertNonNegativeDecimal(values.salePrice ?? "0", "Preço de venda")
  assertNonNegativeDecimal(values.costPrice ?? "0", "Custo")
  const [row] = await getDb().insert(orders).values(values).returning()
  return row
}

export async function updateOrder(id: string, values: Partial<NewOrderRow>) {
  if (values.creditAmount != null) assertNonNegativeDecimal(values.creditAmount, "Créditos")
  if (values.salePrice != null) assertNonNegativeDecimal(values.salePrice, "Preço de venda")
  if (values.costPrice != null) assertNonNegativeDecimal(values.costPrice, "Custo")
  const [row] = await getDb()
    .update(orders)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning()
  return row ?? null
}

export async function transitionOrder(id: string, nextStatus: OrderStatus, administrative = false) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!current) throw new Error("Pedido não encontrado.")
    assertOrderTransition(current.status, nextStatus, administrative)
    const now = new Date()
    const [row] = await tx
      .update(orders)
      .set({
        status: nextStatus,
        paidAt: nextStatus === "paid" && !current.paidAt ? now : current.paidAt,
        deliveredAt: nextStatus === "delivered" && !current.deliveredAt ? now : current.deliveredAt,
        updatedAt: now,
      })
      .where(eq(orders.id, id))
      .returning()
    return row
  })
}

export async function archiveOrder(id: string) {
  const [row] = await getDb()
    .update(orders)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning()
  return row ?? null
}

export async function restoreOrder(id: string) {
  const [row] = await getDb()
    .update(orders)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(orders.id, id))
    .returning()
  return row ?? null
}

export const ordersService = {
  list: listOrders,
  create: createOrder,
  update: updateOrder,
  transition: transitionOrder,
  archive: archiveOrder,
  restore: restoreOrder,
}
