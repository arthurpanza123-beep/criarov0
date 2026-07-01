import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { customers } from "./customers"
import { orderStatusEnum } from "./enums"
import { archivedAt, createdAt, id, money, updatedAt } from "./shared"

export const orders = pgTable(
  "orders",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict", onUpdate: "cascade" }),
    description: text("description").notNull(),
    creditAmount: money("credit_amount").notNull().default("0"),
    salePrice: money("sale_price").notNull().default("0"),
    costPrice: money("cost_price").notNull().default("0"),
    currency: text("currency").notNull().default("USD"),
    status: orderStatusEnum("status").notNull().default("draft"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("orders_credit_amount_non_negative_chk", sql`${table.creditAmount} >= 0`),
    check("orders_sale_price_non_negative_chk", sql`${table.salePrice} >= 0`),
    check("orders_cost_price_non_negative_chk", sql`${table.costPrice} >= 0`),
    check("orders_currency_length_chk", sql`char_length(${table.currency}) between 3 and 8`),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_status_idx").on(table.status),
    index("orders_created_at_idx").on(table.createdAt),
  ],
)

export type OrderRow = typeof orders.$inferSelect
export type NewOrderRow = typeof orders.$inferInsert
