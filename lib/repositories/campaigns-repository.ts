import { desc, eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { campaigns, type NewCampaignRow } from "@/lib/db/schema"
import { normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createCampaignsRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(limit).offset(offset)
    },
    async create(values: NewCampaignRow) {
      const [row] = await db.insert(campaigns).values(values).returning()
      return row
    },
    async update(id: string, values: Partial<NewCampaignRow>) {
      const [row] = await db
        .update(campaigns)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(campaigns.id, id))
        .returning()
      return row ?? null
    },
    async archive(id: string) {
      const [row] = await db
        .update(campaigns)
        .set({ active: false, archivedAt: new Date(), updatedAt: new Date() })
        .where(eq(campaigns.id, id))
        .returning()
      return row ?? null
    },
  }
}

export const campaignsRepository = {
  findById: (id: string) => createCampaignsRepository().findById(id),
  list: (input?: PaginationInput) => createCampaignsRepository().list(input),
  create: (values: NewCampaignRow) => createCampaignsRepository().create(values),
  update: (id: string, values: Partial<NewCampaignRow>) =>
    createCampaignsRepository().update(id, values),
  archive: (id: string) => createCampaignsRepository().archive(id),
}
