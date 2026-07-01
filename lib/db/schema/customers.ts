import { sql } from "drizzle-orm"
import { check, index, pgTable, text } from "drizzle-orm/pg-core"

import { archivedAt, createdAt, id, updatedAt } from "./shared"

export const customers = pgTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("customers_email_lower_chk", sql`${table.email} is null or ${table.email} = lower(${table.email})`),
    index("customers_email_idx").on(table.email),
    index("customers_archived_at_idx").on(table.archivedAt),
  ],
)

export type CustomerRow = typeof customers.$inferSelect
export type NewCustomerRow = typeof customers.$inferInsert
