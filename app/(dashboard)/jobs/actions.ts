"use server"

import { z } from "zod"

import { recordAdminActivity } from "@/lib/admin/audit"
import { idFormSchema, parseForm } from "@/lib/admin/form-schemas"
import { guardedAction } from "@/lib/admin/server-action"
import { runQueueOnce } from "@/lib/jobs/worker"
import { cancelJob, enqueueJob, retryJob } from "@/lib/services/jobs-service"

const paths = ["/jobs", "/sistema", "/atividades", "/notificacoes"]

export async function enqueueReconcileAction(formData: FormData) {
  return guardedAction("jobs", "create", paths, async (actorId) => {
    const { managedAccountId } = z
      .object({ managedAccountId: z.string().uuid("Conta inválida.") })
      .parse(Object.fromEntries(formData))
    const job = await enqueueJob({
      type: "reconcile_account",
      payload: { managedAccountId },
      createdBy: actorId,
      idempotencyKey: `reconcile:${managedAccountId}:${new Date().toISOString().slice(0, 10)}`,
    })
    await recordAdminActivity({ actorUserId: actorId, entityType: "job", entityId: job.id, action: "job_enqueued", metadata: { type: job.type } })
    return job
  })
}

export async function enqueueMaintenanceAction() {
  return guardedAction("jobs", "create", paths, async (actorId) => {
    const job = await enqueueJob({ type: "maintenance", payload: { retentionDays: 30 }, createdBy: actorId })
    await recordAdminActivity({ actorUserId: actorId, entityType: "job", entityId: job.id, action: "job_enqueued", metadata: { type: job.type } })
    return job
  })
}

export async function enqueueReportAction() {
  return guardedAction("jobs", "create", paths, async (actorId) => {
    const job = await enqueueJob({ type: "export_report", payload: {}, createdBy: actorId })
    await recordAdminActivity({ actorUserId: actorId, entityType: "job", entityId: job.id, action: "job_enqueued", metadata: { type: job.type } })
    return job
  })
}

export async function retryJobAction(formData: FormData) {
  return guardedAction("jobs", "manage", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const job = await retryJob(id)
    if (!job) throw new Error("Job não pode ser reprocessado neste estado.")
    await recordAdminActivity({ actorUserId: actorId, entityType: "job", entityId: id, action: "job_retried" })
    return job
  })
}

export async function cancelJobAction(formData: FormData) {
  return guardedAction("jobs", "manage", paths, async (actorId) => {
    const { id } = parseForm(idFormSchema, formData)
    const job = await cancelJob(id)
    if (!job) throw new Error("Job não pode ser cancelado neste estado.")
    await recordAdminActivity({ actorUserId: actorId, entityType: "job", entityId: id, action: "job_cancelled" })
    return job
  })
}

export async function runQueueNowAction() {
  return guardedAction("jobs", "manage", paths, async (actorId) => {
    const processed = await runQueueOnce(`manual-${actorId}`)
    await recordAdminActivity({ actorUserId: actorId, entityType: "job", entityId: actorId, action: "queue_processed", metadata: { processed } })
    return { processed }
  })
}
