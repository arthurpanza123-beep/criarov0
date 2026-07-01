import { eq } from "drizzle-orm"

import type { getDb } from "@/lib/db"
import { settings } from "@/lib/db/schema"

type Db = ReturnType<typeof getDb>

export async function upsertSetting(key: string, value: unknown, db: Db) {
  const [row] = await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value,
        updatedAt: new Date(),
      },
    })
    .returning()

  return row
}

export async function getSetting(key: string, db: Db) {
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1)
  return row ?? null
}

export const settingsService = {
  get: getSetting,
  upsert: upsertSetting,
}
