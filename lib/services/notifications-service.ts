import "server-only"

import { and, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm"

import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { notifications, type NewNotificationRow } from "@/lib/db/schema"

export async function listNotifications(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(notifications.title, `%${input.q}%`),
          ilike(notifications.message, `%${input.q}%`),
        )
      : undefined,
    input.unread === true ? isNull(notifications.readAt) : undefined,
    input.unread === false ? isNotNull(notifications.readAt) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db.select({ value: count() }).from(notifications).where(where)
  const data = await db
    .select()
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function unreadNotificationsCount() {
  const [row] = await getDb()
    .select({ value: count() })
    .from(notifications)
    .where(isNull(notifications.readAt))
  return row?.value ?? 0
}

export async function createNotification(values: NewNotificationRow) {
  const [row] = await getDb().insert(notifications).values(values).returning()
  return row
}

export async function markNotificationRead(id: string) {
  const [row] = await getDb()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(eq(notifications.id, id))
    .returning()
  return row ?? null
}

export async function markAllNotificationsRead() {
  await getDb().update(notifications).set({ readAt: new Date() }).where(isNull(notifications.readAt))
}

export const notificationsService = {
  list: listNotifications,
  unreadCount: unreadNotificationsCount,
  create: createNotification,
  markRead: markNotificationRead,
  markAllRead: markAllNotificationsRead,
}
