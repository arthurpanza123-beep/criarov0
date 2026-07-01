"use server"

import { revalidatePath } from "next/cache"

import { recordAuthActivity } from "@/lib/auth/audit"
import { isRole } from "@/lib/auth/permissions"
import { requireSession } from "@/lib/auth/session"
import {
  blockUser,
  createInternalUser,
  forcePasswordChange,
  reactivateUser,
  updateUserRole,
} from "@/lib/auth/users"

function readRole(formData: FormData) {
  const role = String(formData.get("role") ?? "")
  if (!isRole(role)) throw new Error("Papel inválido.")
  return role
}

function readUserId(formData: FormData) {
  const userId = String(formData.get("userId") ?? "")
  if (!userId) throw new Error("Usuário inválido.")
  return userId
}

export async function createUserAction(formData: FormData) {
  const actor = await requireSession()
  const name = String(formData.get("name") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim().toLowerCase()
  const password = String(formData.get("password") ?? "")
  const role = readRole(formData)

  if (!name || !email || !password) throw new Error("Dados inválidos.")

  const created = await createInternalUser({ name, email, role, password })
  await recordAuthActivity({
    actorUserId: actor.id,
    targetUserId: created.id,
    action: "user_created",
    metadata: {
      role,
    },
  })

  revalidatePath("/usuarios")
}

export async function changeRoleAction(formData: FormData) {
  const actor = await requireSession()
  const userId = readUserId(formData)
  const role = readRole(formData)

  const updated = await updateUserRole(userId, role)
  await recordAuthActivity({
    actorUserId: actor.id,
    targetUserId: userId,
    action: "role_changed",
    metadata: {
      role: updated?.role ?? role,
    },
  })

  revalidatePath("/usuarios")
}

export async function blockUserAction(formData: FormData) {
  const actor = await requireSession()
  const userId = readUserId(formData)

  await blockUser(userId)
  await recordAuthActivity({
    actorUserId: actor.id,
    targetUserId: userId,
    action: "user_blocked",
  })

  revalidatePath("/usuarios")
}

export async function reactivateUserAction(formData: FormData) {
  const actor = await requireSession()
  const userId = readUserId(formData)

  await reactivateUser(userId)
  await recordAuthActivity({
    actorUserId: actor.id,
    targetUserId: userId,
    action: "user_reactivated",
  })

  revalidatePath("/usuarios")
}

export async function forcePasswordChangeAction(formData: FormData) {
  const actor = await requireSession()
  const userId = readUserId(formData)

  await forcePasswordChange(userId)
  await recordAuthActivity({
    actorUserId: actor.id,
    targetUserId: userId,
    action: "must_change_password_marked",
  })

  revalidatePath("/usuarios")
}
