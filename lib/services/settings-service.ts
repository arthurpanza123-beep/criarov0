import { count, eq } from "drizzle-orm"
import { z } from "zod"

import type { getDb } from "@/lib/db"
import { getDb as getDefaultDb } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"

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

export const editableSettings = {
  "app.currency": z.string().trim().min(3).max(8),
  "app.locale": z.string().trim().min(2).max(16),
  "app.timezone": z.string().trim().min(2).max(64),
  "app.defaultMonthlyLimit": z.union([z.string(), z.number()]).transform(String),
} as const

export type EditableSettingKey = keyof typeof editableSettings

export function isEditableSettingKey(key: string): key is EditableSettingKey {
  return key in editableSettings
}

export async function listSettings(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDefaultDb()
  const [totalRow] = await db.select({ value: count() }).from(settings)
  const data = await db.select().from(settings).limit(input.pageSize).offset(input.offset)
  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function updateEditableSetting(key: string, value: unknown, db: Db = getDefaultDb()) {
  if (!isEditableSettingKey(key)) {
    throw new Error("Configuração não editável.")
  }
  const parsed = editableSettings[key].parse(value)
  return upsertSetting(key, parsed, db)
}

export const settingsService = {
  get: getSetting,
  list: listSettings,
  upsert: upsertSetting,
  updateEditable: updateEditableSetting,
}
