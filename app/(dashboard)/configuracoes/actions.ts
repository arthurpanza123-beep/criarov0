"use server"

import { recordAdminActivity } from "@/lib/admin/audit"
import { parseForm, settingFormSchema } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { runFormAction, type FormActionState } from "@/lib/admin/form-state"
import { settingsService } from "@/lib/services/settings-service"
import type { SettingRow } from "@/lib/db/schema"

const paths = ["/configuracoes", "/atividades"]

/** Feedback-friendly variant of updateSettingAction, for ActionForm/useActionState. */
export async function updateSettingFormAction(
  state: FormActionState<SettingRow>,
  formData: FormData,
): Promise<FormActionState<SettingRow>> {
  return runFormAction("settings", "update", paths, state, async (actorId) => {
    const input = parseForm(settingFormSchema, formData)
    const row = await settingsService.updateEditable(input.key, input.value)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "setting",
      entityId: row.id,
      action: "setting_updated",
      metadata: { key: row.key },
    })
    return row
  }, formData)
}

export async function updateSettingAction(formData: FormData) {
  return guardedAction("settings", "update", paths, async (actorId) => {
    const input = parseForm(settingFormSchema, formData)
    const row = await settingsService.updateEditable(input.key, input.value)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "setting",
      entityId: row.id,
      action: "setting_updated",
      metadata: { key: row.key },
    })
    return row
  })
}
