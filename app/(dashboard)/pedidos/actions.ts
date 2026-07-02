"use server"

import { revalidatePath } from "next/cache"

import { recordAdminActivity } from "@/lib/admin/audit"
import { idFormSchema, orderFormSchema, orderTransitionFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { runFormAction, type FormActionState } from "@/lib/admin/form-state"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { ordersService } from "@/lib/services/orders-service"
import type { OrderRow } from "@/lib/db/schema"

const paths = ["/", "/pedidos", "/clientes", "/atividades"]

/** Feedback-friendly variant of createOrderAction, for ActionForm/useActionState. */
export async function createOrderFormAction(
  state: FormActionState<OrderRow>,
  formData: FormData,
): Promise<FormActionState<OrderRow>> {
  return runFormAction("orders", "create", paths, state, async (actorId) => {
    const input = parseForm(orderFormSchema, formData)
    const row = await ordersService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "order",
      entityId: row.id,
      action: "order_created",
      metadata: { customerId: row.customerId, status: row.status },
    })
    return row
  }, formData)
}

export async function createOrderAction(formData: FormData) {
  return guardedAction("orders", "create", paths, async (actorId) => {
    const input = parseForm(orderFormSchema, formData)
    const row = await ordersService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "order",
      entityId: row.id,
      action: "order_created",
      metadata: { customerId: row.customerId, status: row.status },
    })
    return row
  })
}

export async function updateOrderAction(formData: FormData) {
  return guardedAction("orders", "manage", paths, async (actorId) => {
    const input = parseForm(orderFormSchema.required({ id: true }), formData)
    const row = await ordersService.update(input.id, input)
    if (!row) throw new Error("Pedido não encontrado.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "order",
      entityId: row.id,
      action: "order_updated",
      metadata: { status: row.status },
    })
    return row
  })
}

export async function transitionOrderAction(formData: FormData): Promise<void> {
  try {
    const actor = await requirePermission("orders", "update")
    const input = parseForm(orderTransitionFormSchema, formData)
    const row = await ordersService.transition(input.id, input.status, can(actor.role, "orders", "manage"))
    await recordAdminActivity({
      actorUserId: actor.id,
      entityType: "order",
      entityId: row.id,
      action: "order_status_changed",
      metadata: { status: row.status },
    })
    for (const path of paths) revalidatePath(path)
  } catch {
    // Safe no-op: errors are handled server-side without leaking a stack trace.
  }
}

export async function archiveOrderAction(formData: FormData) {
  return guardedAction("orders", "archive", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await ordersService.archive(id)
    if (!row) throw new Error("Pedido não encontrado.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "order",
      entityId: row.id,
      action: "order_archived",
    })
    return row
  })
}

export async function restoreOrderAction(formData: FormData) {
  return guardedAction("orders", "update", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await ordersService.restore(id)
    if (!row) throw new Error("Pedido não encontrado.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "order",
      entityId: row.id,
      action: "order_restored",
    })
    return row
  })
}
