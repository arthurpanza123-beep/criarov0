import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { orders, type NewOrderRow } from "@/lib/db/schema"
import { normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createOrdersRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewOrderRow) {
      const [row] = await db.insert(orders).values(values).returning()
      return row
    },
    async update(id: string, values: Partial<NewOrderRow>) {
      const [row] = await db
        .update(orders)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning()
      return row ?? null
    },
    async archive(id: string) {
      const [row] = await db
        .update(orders)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(orders.id, id))
        .returning()
      return row ?? null
    },
  }
}

export const ordersRepository = {
  findById: (id: string) => createOrdersRepository().findById(id),
  list: (input?: PaginationInput) => createOrdersRepository().list(input),
  create: (values: NewOrderRow) => createOrdersRepository().create(values),
  update: (id: string, values: Partial<NewOrderRow>) => createOrdersRepository().update(id, values),
  archive: (id: string) => createOrdersRepository().archive(id),
}
