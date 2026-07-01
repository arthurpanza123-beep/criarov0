import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { creditLedger, type NewCreditLedgerRow } from "@/lib/db/schema"
import { normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createCreditLedgerRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(creditLedger).where(eq(creditLedger.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(creditLedger).orderBy(desc(creditLedger.occurredAt)).limit(limit).offset(offset)
    },
    async create(values: NewCreditLedgerRow) {
      const [row] = await db.insert(creditLedger).values(values).returning()
      return row
    },
    async update(id: string, values: Partial<NewCreditLedgerRow>) {
      const [row] = await db.update(creditLedger).set(values).where(eq(creditLedger.id, id)).returning()
      return row ?? null
    },
  }
}

export const creditLedgerRepository = {
  findById: (id: string) => createCreditLedgerRepository().findById(id),
  list: (input?: PaginationInput) => createCreditLedgerRepository().list(input),
  create: (values: NewCreditLedgerRow) => createCreditLedgerRepository().create(values),
  update: (id: string, values: Partial<NewCreditLedgerRow>) =>
    createCreditLedgerRepository().update(id, values),
}
