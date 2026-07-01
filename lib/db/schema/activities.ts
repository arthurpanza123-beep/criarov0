import { sql } from "drizzle-orm"
import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core"

import { createdAt, id } from "./shared"
import { user } from "./auth.generated"

export const activities = pgTable(
  "activities",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [
    index("activities_entity_idx").on(table.entityType, table.entityId),
    index("activities_created_at_idx").on(table.createdAt),
    index("activities_actor_user_id_idx").on(table.actorUserId),
  ],
)

export type ActivityRow = typeof activities.$inferSelect
export type NewActivityRow = typeof activities.$inferInsert
