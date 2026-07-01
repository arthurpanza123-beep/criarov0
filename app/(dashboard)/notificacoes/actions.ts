"use server"

import { notificationIdFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { notificationsService } from "@/lib/services/notifications-service"

const paths = ["/", "/notificacoes"]

export async function markNotificationReadAction(formData: FormData) {
  return guardedAction("dashboard", "read", paths, async () => {
    const { id } = parseForm(notificationIdFormSchema, formData)
    return notificationsService.markRead(id)
  })
}

export async function markAllNotificationsReadAction() {
  return guardedAction("dashboard", "read", paths, async () => {
    await notificationsService.markAllRead()
    return null
  })
}
