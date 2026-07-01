import "server-only"

import { and, eq, ne, sql } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth/auth"
import { canCreateRole, canManageRole, isRole } from "@/lib/auth/permissions"
import { assertCanBlockUser, assertCanChangeUserRole } from "@/lib/auth/policy"
import { assertStrongPassword } from "@/lib/auth/password"
import { requirePermission, requireSession } from "@/lib/auth/session"
import type { Role } from "@/lib/auth/types"
import { getDb } from "@/lib/db"
import { user } from "@/lib/db/schema"

export async function countActiveOwners(excludeUserId?: string) {
  const conditions = [
    eq(user.role, "owner"),
    sql`coalesce(${user.banned}, false) = false`,
  ]
  if (excludeUserId) conditions.push(ne(user.id, excludeUserId))

  const [row] = await getDb()
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(and(...conditions))

  return row?.count ?? 0
}

export async function listUsersForAdmin() {
  await requirePermission("users", "read")

  return getDb()
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      mustChangePassword: user.mustChangePassword,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(user.createdAt)
}

export async function createInternalUser(input: {
  name: string
  email: string
  role: Role
  password: string
}) {
  const actor = await requirePermission("users", "create")

  if (!canCreateRole(actor.role, input.role)) {
    throw new Error("Papel não permitido.")
  }

  assertStrongPassword(input.password)

  const result = await auth.api.createUser({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
      role: input.role,
      data: {
        mustChangePassword: true,
      },
    },
  })

  return result.user
}

export async function updateUserRole(targetUserId: string, nextRole: Role) {
  const actor = await requirePermission("users", "manage")
  if (!isRole(nextRole)) throw new Error("Papel inválido.")

  const [target] = await getDb().select().from(user).where(eq(user.id, targetUserId)).limit(1)
  if (!target || !isRole(target.role)) throw new Error("Usuário não encontrado.")
  assertCanChangeUserRole({
    actorRole: actor.role,
    targetRole: target.role,
    nextRole,
    remainingActiveOwners: await countActiveOwners(target.id),
  })

  await auth.api.setRole({
    body: {
      userId: targetUserId,
      role: nextRole,
    },
    headers: await headers(),
  })

  const [updated] = await getDb().select().from(user).where(eq(user.id, targetUserId)).limit(1)
  if (!updated) throw new Error("Usuário não encontrado.")
  return updated
}

export async function blockUser(targetUserId: string) {
  const actor = await requirePermission("users", "manage")
  const [target] = await getDb().select().from(user).where(eq(user.id, targetUserId)).limit(1)
  if (!target || !isRole(target.role)) throw new Error("Usuário não encontrado.")
  assertCanBlockUser({
    actorId: actor.id,
    actorRole: actor.role,
    targetId: targetUserId,
    targetRole: target.role,
    remainingActiveOwners: await countActiveOwners(target.id),
  })

  await auth.api.banUser({
    body: {
      userId: targetUserId,
      banReason: "blocked_by_owner",
    },
    headers: await headers(),
  })
}

export async function reactivateUser(targetUserId: string) {
  const actor = await requirePermission("users", "manage")

  const [target] = await getDb().select().from(user).where(eq(user.id, targetUserId)).limit(1)
  if (!target || !isRole(target.role)) throw new Error("Usuário não encontrado.")
  if (!canManageRole(actor.role, target.role)) throw new Error("Reativação não permitida.")

  await auth.api.unbanUser({
    body: {
      userId: targetUserId,
    },
    headers: await headers(),
  })
}

export async function forcePasswordChange(targetUserId: string) {
  const actor = await requirePermission("users", "manage")

  const [target] = await getDb().select().from(user).where(eq(user.id, targetUserId)).limit(1)
  if (!target || !isRole(target.role)) throw new Error("Usuário não encontrado.")
  if (!canManageRole(actor.role, target.role)) throw new Error("Ação não permitida.")

  const [updated] = await getDb()
    .update(user)
    .set({ mustChangePassword: true, updatedAt: new Date() })
    .where(eq(user.id, targetUserId))
    .returning()

  return updated
}

export async function assertCurrentUserCanUsePanel() {
  const currentUser = await requireSession()
  if (currentUser.mustChangePassword) {
    throw new Error("must_change_password")
  }
  return currentUser
}
