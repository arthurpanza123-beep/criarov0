import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { managedAccounts, type NewManagedAccountRow } from "@/lib/db/schema"
import { normalizeEmail, normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createManagedAccountsRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(managedAccounts).where(eq(managedAccounts.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(managedAccounts).orderBy(desc(managedAccounts.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewManagedAccountRow) {
      const [row] = await db
        .insert(managedAccounts)
        .values({ ...values, email: normalizeEmail(values.email) ?? values.email })
        .returning()
      return row
    },
    async update(id: string, values: Partial<NewManagedAccountRow>) {
      const nextValues = { ...values, updatedAt: new Date() }
      if (values.email) {
        nextValues.email = normalizeEmail(values.email) ?? values.email
      }

      const [row] = await db
        .update(managedAccounts)
        .set(nextValues)
        .where(eq(managedAccounts.id, id))
        .returning()
      return row ?? null
    },
    async archive(id: string) {
      const [row] = await db
        .update(managedAccounts)
        .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(managedAccounts.id, id))
        .returning()
      return row ?? null
    },
  }
}

export const managedAccountsRepository = {
  findById: (id: string) => createManagedAccountsRepository().findById(id),
  list: (input?: PaginationInput) => createManagedAccountsRepository().list(input),
  create: (values: NewManagedAccountRow) => createManagedAccountsRepository().create(values),
  update: (id: string, values: Partial<NewManagedAccountRow>) =>
    createManagedAccountsRepository().update(id, values),
  archive: (id: string) => createManagedAccountsRepository().archive(id),
}
