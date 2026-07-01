"use server"

import { recordAdminActivity } from "@/lib/admin/audit"
import { customerFormSchema, idFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { customersService } from "@/lib/services/customers-service"

const paths = ["/", "/clientes", "/pedidos", "/atividades"]

export async function createCustomerAction(formData: FormData) {
  return guardedAction("customers", "create", paths, async (actorId) => {
    const input = parseForm(customerFormSchema, formData)
    const row = await customersService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "customer",
      entityId: row.id,
      action: "customer_created",
    })
    return row
  })
}

export async function updateCustomerAction(formData: FormData) {
  return guardedAction("customers", "update", paths, async (actorId) => {
    const input = parseForm(customerFormSchema.required({ id: true }), formData)
    const row = await customersService.update(input.id, input)
    if (!row) throw new Error("Cliente não encontrado.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "customer",
      entityId: row.id,
      action: "customer_updated",
    })
    return row
  })
}

export async function archiveCustomerAction(formData: FormData) {
  return guardedAction("customers", "archive", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await customersService.archive(id)
    if (!row) throw new Error("Cliente não encontrado.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "customer",
      entityId: row.id,
      action: "customer_archived",
    })
    return row
  })
}

export async function restoreCustomerAction(formData: FormData) {
  return guardedAction("customers", "update", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await customersService.restore(id)
    if (!row) throw new Error("Cliente não encontrado.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "customer",
      entityId: row.id,
      action: "customer_restored",
    })
    return row
  })
}
