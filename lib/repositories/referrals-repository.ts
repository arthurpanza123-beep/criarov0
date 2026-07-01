import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { referrals, type NewReferralRow } from "@/lib/db/schema"
import { normalizeEmail, normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createReferralsRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(referrals).where(eq(referrals.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(referrals).orderBy(desc(referrals.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewReferralRow) {
      const [row] = await db
        .insert(referrals)
        .values({ ...values, contactEmail: normalizeEmail(values.contactEmail) })
        .returning()
      return row
    },
    async update(id: string, values: Partial<NewReferralRow>) {
      const [row] = await db
        .update(referrals)
        .set({ ...values, contactEmail: normalizeEmail(values.contactEmail), updatedAt: new Date() })
        .where(eq(referrals.id, id))
        .returning()
      return row ?? null
    },
    async archive(id: string) {
      const [row] = await db
        .update(referrals)
        .set({ status: "archived", archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(referrals.id, id))
        .returning()
      return row ?? null
    },
  }
}

export const referralsRepository = {
  findById: (id: string) => createReferralsRepository().findById(id),
  list: (input?: PaginationInput) => createReferralsRepository().list(input),
  create: (values: NewReferralRow) => createReferralsRepository().create(values),
  update: (id: string, values: Partial<NewReferralRow>) =>
    createReferralsRepository().update(id, values),
  archive: (id: string) => createReferralsRepository().archive(id),
}
