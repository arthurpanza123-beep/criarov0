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

export type ChangePasswordState = {
  error?: string
}

export async function changePasswordAction(_state: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const currentUser = await requireSession()
  const currentPassword = String(formData.get("currentPassword") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "Preencha todos os campos." }
  }
  if (currentPassword === newPassword) {
    return { error: "A nova senha precisa ser diferente da atual." }
  }
  if (newPassword !== confirmPassword) {
    return { error: "A confirmação não confere." }
  }

  const passwordValidation = validateStrongPassword(newPassword)
  if (!passwordValidation.ok) {
    return { error: passwordValidation.failures[0] ?? "Senha inválida." }
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
    return { error: "Não foi possível alterar a senha." }
  }

  redirect("/")
}
