"use server"

import { z } from "zod"

import { recordAdminActivity } from "@/lib/admin/audit"
import { idFormSchema, managedAccountFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { creditLedgerService } from "@/lib/services/credit-ledger-service"
import { managedAccountsService } from "@/lib/services/managed-accounts-service"
import { notificationsService } from "@/lib/services/notifications-service"

const paths = ["/", "/contas", "/creditos", "/atividades", "/notificacoes"]

export async function createManagedAccountAction(formData: FormData) {
  return guardedAction("managedAccounts", "create", paths, async (actorId) => {
    const input = parseForm(managedAccountFormSchema, formData)
    const row = await managedAccountsService.create(input)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "managed_account",
      entityId: row.id,
      action: "managed_account_created",
      metadata: { status: row.status, provider: row.provider },
    })
    return row
  })
}

export async function updateManagedAccountAction(formData: FormData) {
  return guardedAction("managedAccounts", "manage", paths, async (actorId) => {
    const input = parseForm(managedAccountFormSchema.required({ id: true }), formData)
    const row = await managedAccountsService.update(input.id, input)
    if (!row) throw new Error("Conta não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "managed_account",
      entityId: row.id,
      action: "managed_account_updated",
      metadata: { status: row.status },
    })
    return row
  })
}

export async function updateManagedAccountStatusAction(formData: FormData) {
  return guardedAction("managedAccounts", "update", paths, async (actorId) => {
    const input = z
      .object({
        id: z.string().trim().min(1),
        status: z.enum(["active", "inactive", "suspended"]),
      })
      .parse(Object.fromEntries(formData))
    const row = await managedAccountsService.update(input.id, { status: input.status })
    if (!row) throw new Error("Conta não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "managed_account",
      entityId: row.id,
      action: "managed_account_status_changed",
      metadata: { status: row.status },
    })
    return row
  })
}

export async function archiveManagedAccountAction(formData: FormData) {
  return guardedAction("managedAccounts", "archive", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await managedAccountsService.archive(id)
    if (!row) throw new Error("Conta não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "managed_account",
      entityId: row.id,
      action: "managed_account_archived",
    })
    return row
  })
}

export async function restoreManagedAccountAction(formData: FormData) {
  return guardedAction("managedAccounts", "update", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const row = await managedAccountsService.restore(id)
    if (!row) throw new Error("Conta não encontrada.")
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "managed_account",
      entityId: row.id,
      action: "managed_account_restored",
    })
    return row
  })
}

/**
 * Reconciles the persisted account balance against the confirmed ledger. This is
 * read-only over financial data: it NEVER auto-corrects a divergence in the main
 * database. It records the reconciliation report as an activity and raises a
 * warning notification when a divergence is detected.
 */
export async function reconcileManagedAccountAction(formData: FormData) {
  return guardedAction("managedAccounts", "manage", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const report = await creditLedgerService.reconcile(id)
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "managed_account",
      entityId: id,
      action: "credit_balance_reconciled",
      metadata: {
        persisted: report.persisted,
        calculated: report.calculated,
        diverged: report.diverged,
      },
    })
    if (report.diverged) {
      await notificationsService.create({
        title: "Divergência de saldo detectada",
        message: `Saldo persistido (${report.persisted}) diverge do saldo calculado pelo ledger confirmado (${report.calculated}). Nenhuma correção automática foi aplicada.`,
        type: "warning",
      })
    }
    return report
  })
}
