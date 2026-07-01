import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { activities, type NewActivityRow } from "@/lib/db/schema"
import { normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createActivitiesRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(activities).where(eq(activities.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(activities).orderBy(desc(activities.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewActivityRow) {
      const [row] = await db.insert(activities).values(values).returning()
      return row
    },
  }
}

export const activitiesRepository = {
  findById: (id: string) => createActivitiesRepository().findById(id),
  list: (input?: PaginationInput) => createActivitiesRepository().list(input),
  create: (values: NewActivityRow) => createActivitiesRepository().create(values),
}
