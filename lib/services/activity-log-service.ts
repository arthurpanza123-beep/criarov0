import "server-only"

import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm"

import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { activities, user } from "@/lib/db/schema"

export async function listActivities(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(activities.action, `%${input.q}%`),
          ilike(activities.entityType, `%${input.q}%`),
        )
      : undefined,
    input.type ? eq(activities.entityType, input.type) : undefined,
    input.from ? gte(activities.createdAt, input.from) : undefined,
    input.to ? lte(activities.createdAt, input.to) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db.select({ value: count() }).from(activities).where(where)
  const data = await db
    .select({
      id: activities.id,
      actorUserId: activities.actorUserId,
      actorName: user.name,
      actorEmail: user.email,
      entityType: activities.entityType,
      entityId: activities.entityId,
      action: activities.action,
      metadata: activities.metadata,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .leftJoin(user, eq(user.id, activities.actorUserId))
    .where(where)
    .orderBy(desc(activities.createdAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export const activitiesService = {
  list: listActivities,
}
