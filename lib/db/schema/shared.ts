import { sql } from "drizzle-orm"
import { numeric, timestamp, uuid } from "drizzle-orm/pg-core"

export const id = () => uuid("id").defaultRandom().primaryKey()

export const money = (name: string) =>
  numeric(name, { precision: 14, scale: 2 })

export const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow()

export const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()

export const archivedAt = () => timestamp("archived_at", { withTimezone: true })

export const nonNegative = (column: unknown) => sql`${column} >= 0`
