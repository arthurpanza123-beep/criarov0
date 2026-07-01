import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { notificationTypeEnum } from "./enums"
import { createdAt, id } from "./shared"

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: notificationTypeEnum("type").notNull().default("info"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    index("notifications_read_at_idx").on(table.readAt),
    index("notifications_created_at_idx").on(table.createdAt),
  ],
)

export type NotificationRow = typeof notifications.$inferSelect
export type NewNotificationRow = typeof notifications.$inferInsert
