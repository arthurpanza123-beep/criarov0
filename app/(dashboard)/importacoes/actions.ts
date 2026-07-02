"use server"

import { recordAdminActivity } from "@/lib/admin/audit"
import { guardedAction } from "@/lib/admin/server-action"
import { IMPORT_LIMITS, importService, isImportEntity } from "@/lib/services/import-service"

const paths = ["/importacoes", "/atividades", "/contas", "/campanhas", "/clientes"]

export async function importAction(formData: FormData) {
  return guardedAction("imports", "create", paths, async (actorId) => {
    const entity = String(formData.get("entity") ?? "")
    const dryRun = String(formData.get("dryRun") ?? "true") !== "false"
    if (!isImportEntity(entity)) throw new Error("Entidade de importação inválida.")

    const file = formData.get("file")
    if (!(file instanceof File) || file.size === 0) throw new Error("Selecione um arquivo CSV.")
    if (file.size > IMPORT_LIMITS.maxBytes) {
      throw new Error(`Arquivo excede o tamanho máximo de ${IMPORT_LIMITS.maxBytes} bytes.`)
    }

    const csv = await file.text()
    const result = await importService.run(entity, csv, { dryRun, actorId, filename: file.name })
    await recordAdminActivity({
      actorUserId: actorId,
      entityType: "import_batch",
      entityId: result.batch.id,
      action: dryRun ? "import_dry_run" : "import_committed",
      metadata: { entity, imported: result.imported, invalid: result.report.invalidRows, duplicates: result.report.duplicateRows },
    })
    return result.batch
  })
}
