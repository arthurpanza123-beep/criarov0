import { eq } from "drizzle-orm"

import { getDb } from "@/lib/db"
import { settings, type NewSettingRow } from "@/lib/db/schema"
import { normalizePagination, type PaginationInput } from "@/lib/repositories/pagination"

type Db = ReturnType<typeof getDb>

export function createSettingsRepository(db: Db = getDb()) {
  return {
    async findById(id: string) {
      const [row] = await db.select().from(settings).where(eq(settings.id, id)).limit(1)
      return row ?? null
    },
    async findByKey(key: string) {
      const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
      return row ?? null
    },
    async list(input?: PaginationInput) {
      const { limit, offset } = normalizePagination(input)
      return db.select().from(settings).limit(limit).offset(offset)
    },
    async create(values: NewSettingRow) {
      const [row] = await db.insert(settings).values(values).returning()
      return row
    },
    async update(id: string, values: Partial<NewSettingRow>) {
      const [row] = await db
        .update(settings)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(settings.id, id))
        .returning()
      return row ?? null
    },
    async upsert(key: string, value: unknown) {
      const [row] = await db
        .insert(settings)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedAt: new Date() },
        })
        .returning()
      return row
    },
  }
}

export const settingsRepository = {
  findById: (id: string) => createSettingsRepository().findById(id),
  findByKey: (key: string) => createSettingsRepository().findByKey(key),
  list: (input?: PaginationInput) => createSettingsRepository().list(input),
  create: (values: NewSettingRow) => createSettingsRepository().create(values),
  update: (id: string, values: Partial<NewSettingRow>) =>
    createSettingsRepository().update(id, values),
  upsert: (key: string, value: unknown) => createSettingsRepository().upsert(key, value),
}
