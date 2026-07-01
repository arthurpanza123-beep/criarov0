import "server-only"

import { eq } from "drizzle-orm"
import { headers } from "next/headers"

import { auth } from "@/lib/auth/auth"
import { assertValidRole, hasPermission } from "@/lib/auth/permissions"
import type { Action, AuthUser, Resource, Role } from "@/lib/auth/types"
import { getDb } from "@/lib/db"
import { user } from "@/lib/db/schema"

export class AuthGuardError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message)
  }
}

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
    query: {
      disableCookieCache: true,
    },
  })
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getCurrentSession()
  if (!session) return null

  const [row] = await getDb().select().from(user).where(eq(user.id, session.user.id)).limit(1)
  if (!row) return null

  assertValidRole(row.role)

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    banned: row.banned,
    banReason: row.banReason,
    banExpires: row.banExpires,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function requireSession() {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    throw new AuthGuardError(401, "Não autenticado.")
  }

  if (currentUser.banned) {
    throw new AuthGuardError(403, "Usuário bloqueado.")
  }

  return currentUser
}

export async function requireRole(role: Role) {
  const currentUser = await requireSession()
  if (currentUser.role !== role) {
    throw new AuthGuardError(403, "Acesso negado.")
  }
  return currentUser
}

export async function requirePermission(resource: Resource, action: Action) {
  const currentUser = await requireSession()
  if (!hasPermission(currentUser.role, { resource, action })) {
    throw new AuthGuardError(403, "Acesso negado.")
  }
  return currentUser
}

export async function assertPermission(resource: Resource, action: Action) {
  await requirePermission(resource, action)
}
