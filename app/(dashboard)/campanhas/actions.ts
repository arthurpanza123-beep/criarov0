"use server"

import { recordAdminActivity } from "@/lib/admin/audit"
import { campaignFormSchema, idFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { runFormAction, type FormActionState } from "@/lib/admin/form-state"
import { campaignsService } from "@/lib/services/campaigns-service"
import type { CampaignRow } from "@/lib/db/schema"

const paths = ["/", "/campanhas", "/indicacoes", "/atividades"]

/** Feedback-friendly variant of createCampaignAction, for ActionForm/useActionState. */
export async function createCampaignFormAction(
  state: FormActionState<CampaignRow>,
  formData: FormData,
): Promise<FormActionState<CampaignRow>> {
  return runFormAction("campaigns", "create", paths, state, async (actorId) => {
    const input = parseForm(campaignFormSchema, formData)
    const row = await campaignsService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "campaign",
      entityId: row.id,
      action: "campaign_created",
      metadata: { platform: row.platform, active: row.active },
    })
    return row
  }, formData)
}

export async function createCampaignAction(formData: FormData) {
  return guardedAction("campaigns", "create", paths, async (actorId) => {
    const input = parseForm(campaignFormSchema, formData)
    const row = await campaignsService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "campaign",
      entityId: row.id,
      action: "campaign_created",
      metadata: { platform: row.platform, active: row.active },
    })
    return row
  })
}

export async function updateCampaignAction(formData: FormData) {
  return guardedAction("campaigns", "update", paths, async (actorId) => {
    const input = parseForm(campaignFormSchema.required({ id: true }), formData)
    const row = await campaignsService.update(input.id, input)
    if (!row) throw new Error("Campanha não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "campaign",
      entityId: row.id,
      action: "campaign_updated",
      metadata: { active: row.active },
    })
    return row
  })
}

export async function archiveCampaignAction(formData: FormData) {
  return guardedAction("campaigns", "archive", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await campaignsService.archive(id)
    if (!row) throw new Error("Campanha não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "campaign",
      entityId: row.id,
      action: "campaign_archived",
    })
    return row
  })
}

export async function restoreCampaignAction(formData: FormData) {
  return guardedAction("campaigns", "update", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await campaignsService.restore(id)
    if (!row) throw new Error("Campanha não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "campaign",
      entityId: row.id,
      action: "campaign_restored",
    })
    return row
  })
}
