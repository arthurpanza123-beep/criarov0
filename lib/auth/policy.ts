import { canManageRole } from "@/lib/auth/permissions"
import type { Role } from "@/lib/auth/types"

export function assertCanChangeUserRole(input: {
  actorRole: Role
  targetRole: Role
  nextRole: Role
  remainingActiveOwners: number
}) {
  if (!canManageRole(input.actorRole, input.targetRole) || !canManageRole(input.actorRole, input.nextRole)) {
    throw new Error("Alteração de papel não permitida.")
  }
  if (input.targetRole === "owner" && input.nextRole !== "owner" && input.remainingActiveOwners === 0) {
    throw new Error("Não é permitido remover o último owner ativo.")
  }
}

export function assertCanBlockUser(input: {
  actorId: string
  actorRole: Role
  targetId: string
  targetRole: Role
  remainingActiveOwners: number
}) {
  if (input.actorId === input.targetId) {
    throw new Error("Owner não pode bloquear a si mesmo.")
  }
  if (!canManageRole(input.actorRole, input.targetRole)) {
    throw new Error("Bloqueio não permitido.")
  }
  if (input.targetRole === "owner" && input.remainingActiveOwners === 0) {
    throw new Error("Não é permitido bloquear o último owner ativo.")
  }
}

export function shouldForcePasswordChange(value: boolean) {
  return value
}
