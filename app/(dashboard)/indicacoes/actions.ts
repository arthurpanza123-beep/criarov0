"use server"

import { can } from "@/lib/auth/permissions"
import { revalidatePath } from "next/cache"
import { recordAdminActivity } from "@/lib/admin/audit"
import {
  idFormSchema,
  parseForm,
  referralApprovalFormSchema,
  referralFormSchema,
  referralTransitionFormSchema,
} from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { runFormAction, type FormActionState } from "@/lib/admin/form-state"
import { requirePermission } from "@/lib/auth/session"
import { referralsService } from "@/lib/services/referrals-service"
import type { ReferralRow } from "@/lib/db/schema"

const paths = ["/", "/indicacoes", "/creditos", "/atividades"]

/** Feedback-friendly variant of createReferralAction, for ActionForm/useActionState. */
export async function createReferralFormAction(
  state: FormActionState<ReferralRow>,
  formData: FormData,
): Promise<FormActionState<ReferralRow>> {
  return runFormAction("referrals", "create", paths, state, async (actorId) => {
    const input = parseForm(referralFormSchema, formData)
    const row = await referralsService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "referral",
      entityId: row.id,
      action: "referral_created",
      metadata: { campaignId: row.campaignId, status: row.status },
    })
    return row
  }, formData)
}

export async function createReferralAction(formData: FormData) {
  return guardedAction("referrals", "create", paths, async (actorId) => {
    const input = parseForm(referralFormSchema, formData)
    const row = await referralsService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "referral",
      entityId: row.id,
      action: "referral_created",
      metadata: { campaignId: row.campaignId, status: row.status },
    })
    return row
  })
}

export async function updateReferralAction(formData: FormData) {
  return guardedAction("referrals", "manage", paths, async (actorId) => {
    const input = parseForm(referralFormSchema.required({ id: true }), formData)
    const row = await referralsService.update(input.id, input)
    if (!row) throw new Error("Indicação não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "referral",
      entityId: row.id,
      action: "referral_updated",
      metadata: { status: row.status },
    })
    return row
  })
}

export async function transitionReferralAction(formData: FormData): Promise<void> {
  try {
    const actor = await requirePermission("referrals", "update")
    const input = parseForm(referralTransitionFormSchema, formData)
    const row = await referralsService.transition(input.id, input.status, can(actor.role, "referrals", "manage"))
    await recordAdminActivity({
      actorUserId: actor.id,
      entityType: "referral",
      entityId: row.id,
      action: "referral_status_changed",
      metadata: { status: row.status },
    })
    for (const path of paths) revalidatePath(path)
  } catch {
    // Safe no-op: errors are handled server-side without leaking a stack trace.
  }
}

export async function approveReferralAction(formData: FormData): Promise<void> {
  try {
    const actor = await requirePermission("referrals", "update")
    const input = parseForm(referralApprovalFormSchema, formData)
    const row = await referralsService.approve(input.id, input.approvedReward, can(actor.role, "referrals", "manage"))
    await recordAdminActivity({
      actorUserId: actor.id,
      entityType: "referral",
      entityId: row.id,
      action: "referral_approved",
      metadata: { approvedReward: row.approvedReward },
    })
    for (const path of paths) revalidatePath(path)
  } catch {
    // Safe no-op: errors are handled server-side without leaking a stack trace.
  }
}

export async function archiveReferralAction(formData: FormData) {
  return guardedAction("referrals", "archive", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await referralsService.archive(id)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "referral",
      entityId: row.id,
      action: "referral_archived",
    })
    return row
  })
}

export async function restoreReferralAction(formData: FormData) {
  return guardedAction("referrals", "update", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await referralsService.restore(id)
    if (!row) throw new Error("Indicação não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "referral",
      entityId: row.id,
      action: "referral_restored",
    })
    return row
  })
}
