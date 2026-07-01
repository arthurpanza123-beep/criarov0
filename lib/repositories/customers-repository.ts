import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { customers, type NewCustomerRow } from "@/lib/db/schema"
import { normalizeEmail, normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createCustomersRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(customers).where(eq(customers.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(customers).orderBy(desc(customers.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewCustomerRow) {
      const [row] = await db
        .insert(customers)
        .values({ ...values, email: normalizeEmail(values.email) })
        .returning()
      return row
    },
    async update(id: string, values: Partial<NewCustomerRow>) {
      const [row] = await db
        .update(customers)
        .set({ ...values, email: normalizeEmail(values.email), updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning()
      return row ?? null
    },
    async archive(id: string) {
      const [row] = await db
        .update(customers)
        .set({ archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning()
      return row ?? null
    },
  }
}

export const customersRepository = {
  findById: (id: string) => createCustomersRepository().findById(id),
  list: (input?: PaginationInput) => createCustomersRepository().list(input),
  create: (values: NewCustomerRow) => createCustomersRepository().create(values),
  update: (id: string, values: Partial<NewCustomerRow>) =>
    createCustomersRepository().update(id, values),
  archive: (id: string) => createCustomersRepository().archive(id),
}
