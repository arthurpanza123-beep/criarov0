import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { notifications, type NewNotificationRow } from "@/lib/db/schema"
import { normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createNotificationsRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(notifications).where(eq(notifications.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewNotificationRow) {
      const [row] = await db.insert(notifications).values(values).returning()
      return row
    },
    async update(id: string, values: Partial<NewNotificationRow>) {
      const [row] = await db.update(notifications).set(values).where(eq(notifications.id, id)).returning()
      return row ?? null
    },
  }
}

export const notificationsRepository = {
  findById: (id: string) => createNotificationsRepository().findById(id),
  list: (input?: PaginationInput) => createNotificationsRepository().list(input),
  create: (values: NewNotificationRow) => createNotificationsRepository().create(values),
  update: (id: string, values: Partial<NewNotificationRow>) =>
    createNotificationsRepository().update(id, values),
}
