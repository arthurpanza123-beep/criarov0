"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { recordAuthActivity } from "@/lib/auth/audit"
import { isRole, roleValues } from "@/lib/auth/permissions"
import { requireSession } from "@/lib/auth/session"
import { KnownFormError, runFormAction, type FormActionState } from "@/lib/admin/form-state"
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

const createUserFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório.").max(200),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(14, "A senha precisa ter ao menos 14 caracteres."),
  role: z.enum(roleValues, { message: "Papel inválido." }),
})

/** Feedback-friendly variant of createUserAction, for ActionForm/useActionState. */
export async function createUserFormAction(
  state: FormActionState<{ id: string } | null>,
  formData: FormData,
): Promise<FormActionState<{ id: string } | null>> {
  return runFormAction("users", "manage", ["/usuarios"], state, async (actorId) => {
    const parsed = createUserFormSchema.safeParse(Object.fromEntries(formData))
    if (!parsed.success) {
      throw parsed.error
    }
    const { name, email, password, role } = parsed.data

    let created
    try {
      created = await createInternalUser({ name, email, role, password })
    } catch {
      throw new KnownFormError("Não foi possível criar o usuário. O e-mail já pode estar em uso.")
    }

    await recordAuthActivity({
      actorUserId: actorId,
      targetUserId: created.id,
      action: "user_created",
      metadata: { role },
    })
    return created
  }, formData)
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
