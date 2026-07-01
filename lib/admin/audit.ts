import "server-only"

import { sanitizeActivityMetadata } from "@/lib/admin/activity-metadata"
import { activitiesRepository } from "@/lib/repositories/activities-repository"

export async function recordAdminActivity(input: {
  actorUserId: string
  entityType: string
  entityId: string
  action: string
  metadata?: Record<string, unknown>
}) {
  await activitiesRepository.create({
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    metadata: sanitizeActivityMetadata(input.metadata),
  })
}
