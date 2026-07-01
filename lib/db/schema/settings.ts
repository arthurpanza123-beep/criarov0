import { sql } from "drizzle-orm"
import { jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

import { id } from "./shared"

export const settings = pgTable(
  "settings",
  {
    id: id(),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("settings_key_unique_idx").on(table.key)],
)

export type SettingRow = typeof settings.$inferSelect
export type NewSettingRow = typeof settings.$inferInsert
