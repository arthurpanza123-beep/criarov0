"use server"

import { recordAdminActivity } from "@/lib/admin/audit"
import { creditLedgerFormSchema, idFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { creditLedgerService } from "@/lib/services/credit-ledger-service"

const paths = ["/", "/creditos", "/contas", "/atividades"]

export async function createCreditLedgerAction(formData: FormData) {
  return guardedAction("creditLedger", "create", paths, async (actorId) => {
    const input = parseForm(creditLedgerFormSchema, formData)
    const row = await creditLedgerService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "credit_ledger",
      entityId: row.id,
      action: "credit_ledger_created",
      metadata: {
        managedAccountId: row.managedAccountId,
        type: row.type,
        status: row.status,
      },
    })
    return row
  })
}

export async function confirmCreditLedgerAction(formData: FormData) {
  return guardedAction("creditLedger", "manage", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await creditLedgerService.confirm(id)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "credit_ledger",
      entityId: row.id,
      action: "credit_ledger_confirmed",
      metadata: { type: row.type },
    })
    return row
  })
}

export async function cancelCreditLedgerAction(formData: FormData) {
  return guardedAction("creditLedger", "manage", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await creditLedgerService.cancel(id)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "credit_ledger",
      entityId: row.id,
      action: "credit_ledger_cancelled",
      metadata: { type: row.type },
    })
    return row
  })
}
