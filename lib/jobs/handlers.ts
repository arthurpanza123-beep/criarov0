import "server-only"

import { z } from "zod"

import type { Logger } from "@/lib/observability/logger"
import { creditLedgerService } from "@/lib/services/credit-ledger-service"
import { importService, isImportEntity } from "@/lib/services/import-service"
import { pruneOldJobs, type JobType } from "@/lib/services/jobs-service"
import { notificationsService } from "@/lib/services/notifications-service"
import { getSimulatorReport } from "@/lib/services/simulator-service"
import { NOTIFICATION_TYPES } from "@/lib/types"

export type JobContext = { jobId: string; attempt: number; logger: Logger }
export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<Record<string, unknown>>

export const handlers: Record<JobType, JobHandler> = {
  reconcile_account: async (payload, ctx) => {
    const { managedAccountId } = z.object({ managedAccountId: z.string().uuid() }).parse(payload)
    const report = await creditLedgerService.reconcile(managedAccountId)
    ctx.logger.info("reconciled managed account", { managedAccountId, diverged: report.diverged })
    if (report.diverged) {
      await notificationsService.create({
        title: "Divergência de saldo detectada",
        message: `Conta ${managedAccountId}: saldo persistido (${report.persisted}) diverge do calculado (${report.calculated}). Nenhuma correção automática aplicada.`,
        type: "warning",
      })
    }
    return { persisted: report.persisted, calculated: report.calculated, diverged: report.diverged }
  },

  generate_notification: async (payload) => {
    const input = z
      .object({
        title: z.string().trim().min(1).max(120),
        message: z.string().trim().min(1).max(500),
        type: z.enum(NOTIFICATION_TYPES).default("info"),
      })
      .parse(payload)
    const row = await notificationsService.create(input)
    return { notificationId: row.id }
  },

  import_entities: async (payload, ctx) => {
    const input = z
      .object({ entity: z.string(), csv: z.string(), actorId: z.string().nullable().optional() })
      .parse(payload)
    if (!isImportEntity(input.entity)) throw new Error("Entidade de importação inválida.")
    const result = await importService.run(input.entity, input.csv, {
      dryRun: false,
      actorId: input.actorId ?? null,
      filename: "job",
    })
    ctx.logger.info("import batch processed", { entity: input.entity, imported: result.imported })
    return {
      batchId: result.batch.id,
      imported: result.imported,
      invalid: result.report.invalidRows,
      duplicates: result.report.duplicateRows,
    }
  },

  export_report: async (payload) => {
    const input = z
      .object({ failureRate: z.number().min(0).max(1).optional(), periodMonths: z.number().int().positive().max(60).optional() })
      .parse(payload)
    const report = await getSimulatorReport(input)
    return report as unknown as Record<string, unknown>
  },

  maintenance: async (payload, ctx) => {
    const input = z.object({ retentionDays: z.number().int().positive().max(365).default(30) }).parse(payload)
    const result = await pruneOldJobs(input.retentionDays)
    ctx.logger.info("maintenance prune completed", { retentionDays: input.retentionDays, ...result })
    return result
  },
}
