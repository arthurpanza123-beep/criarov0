"use server"

import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth/auth"
import { recordAuthActivity } from "@/lib/auth/audit"
import { validateStrongPassword } from "@/lib/auth/password"
import { requireSession } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { user } from "@/lib/db/schema"
import type { FormActionState } from "@/lib/admin/form-state"

export type ChangePasswordState = FormActionState

function nextId(state: ChangePasswordState) {
  return state.submissionId + 1
}

export async function changePasswordAction(state: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const submissionId = nextId(state)
  const currentUser = await requireSession()
  const currentPassword = String(formData.get("currentPassword") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { success: false, error: "Preencha todos os campos.", submissionId }
  }
  if (currentPassword === newPassword) {
    return { success: false, error: "A nova senha precisa ser diferente da atual.", submissionId }
  }
  if (newPassword !== confirmPassword) {
    return { success: false, error: "A confirmação não confere.", submissionId }
  }

  const passwordValidation = validateStrongPassword(newPassword)
  if (!passwordValidation.ok) {
    return { success: false, error: passwordValidation.failures[0] ?? "Senha inválida.", submissionId }
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    })

    await getDb()
      .update(user)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(user.id, currentUser.id))

    await recordAuthActivity({
      actorUserId: currentUser.id,
      targetUserId: currentUser.id,
      action: "password_changed",
      metadata: {
        revokedOtherSessions: true,
      },
    })
  } catch {
    return { success: false, error: "Não foi possível alterar a senha.", submissionId }
  }

  redirect("/")
}
