import "server-only"

import { randomUUID } from "node:crypto"

import { activitiesRepository } from "@/lib/repositories/activities-repository"

type AuditEvent =
  | "owner_created"
  | "user_created"
  | "role_changed"
  | "user_blocked"
  | "user_reactivated"
  | "must_change_password_marked"
  | "password_changed"

export async function recordAuthActivity(input: {
  actorUserId?: string | null
  targetUserId?: string | null
  action: AuditEvent
  metadata?: Record<string, unknown>
}) {
  await activitiesRepository.create({
    actorUserId: input.actorUserId ?? null,
    entityType: "user",
    entityId: input.targetUserId ?? randomUUID(),
    action: input.action,
    metadata: input.metadata ?? {},
  })
}
