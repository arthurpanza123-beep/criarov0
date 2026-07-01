"use server"

import { recordAdminActivity } from "@/lib/admin/audit"
import { parseForm, settingFormSchema } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { settingsService } from "@/lib/services/settings-service"

const paths = ["/configuracoes", "/atividades"]

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
