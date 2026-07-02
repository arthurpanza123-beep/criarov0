import { Upload } from "lucide-react"

import { importFormAction } from "./actions"
import { ActionForm } from "@/components/admin/action-form"
import { DataTable, EmptyState, PageHeader, Panel, StatusBadge, TableShell } from "@/components/admin/primitives"
import { formatDate } from "@/lib/admin/display"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { IMPORT_ENTITIES, IMPORT_LIMITS, importService } from "@/lib/services/import-service"

export const dynamic = "force-dynamic"

const templates: Record<(typeof IMPORT_ENTITIES)[number], string[]> = {
  managed_accounts: importService.templateColumns("managed_accounts"),
  campaigns: importService.templateColumns("campaigns"),
  customers: importService.templateColumns("customers"),
}

type StoredReport = {
  invalidRows?: number
  duplicateRows?: number
  rows?: Array<{ line: number; status: string; errors?: string[] }>
  error?: string
}

export default async function ImportsPage() {
  const actor = await requirePermission("imports", "read")
  const canCreate = can(actor.role, "imports", "create")
  const batches = await importService.list()
  const latest = batches[0]
  const latestReport = (latest?.report ?? {}) as StoredReport
  const latestIssues = (latestReport.rows ?? []).filter((row) => row.status !== "valid").slice(0, 25)

  return (
    <div>
      <PageHeader
        title="Importações"
        description={`CSV com validação, dry-run, deduplicação e commit transacional. Limite: ${IMPORT_LIMITS.maxRows} linhas / ${IMPORT_LIMITS.maxBytes} bytes.`}
      />

      {canCreate ? (
        <Panel className="mb-4">
          <ActionForm
            action={importFormAction}
            successMessage="Importação processada."
            className="grid gap-3 md:grid-cols-[180px_1fr_auto_auto] md:items-end"
            submitLabel="Enviar"
            submitIcon={<Upload className="size-4" />}
          >
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              Entidade
              <select name="entity" required className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
                {IMPORT_ENTITIES.map((entity) => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
              Arquivo CSV
              <input name="file" type="file" accept=".csv,text/csv" required className="h-9 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-sm outline-none" />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="dryRun" value="false" className="size-4" />
              Aplicar (commit)
            </label>
          </ActionForm>
          <p className="mt-3 text-xs text-muted-foreground">
            Colunas esperadas — {Object.entries(templates).map(([entity, cols]) => `${entity}: ${cols.join(", ")}`).join(" · ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Marque &quot;Aplicar&quot; para importar de fato; caso contrário é um dry-run (apenas validação).</p>
        </Panel>
      ) : null}

      <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Histórico</h2>
      {batches.length === 0 ? (
        <EmptyState>Nenhuma importação registrada ainda.</EmptyState>
      ) : (
        <TableShell>
          <DataTable headers={["Entidade", "Modo", "Status", "Total", "Válidas", "Inválidas", "Duplicadas", "Importadas", "Arquivo", "Data"]}>
            {batches.map((batch) => (
              <tr key={batch.id} className="align-top">
                <td className="px-3 py-3">{batch.entity}</td>
                <td className="px-3 py-3">{batch.dryRun ? "dry-run" : "commit"}</td>
                <td className="px-3 py-3">
                  <StatusBadge tone={batch.status === "imported" ? "good" : batch.status === "failed" ? "bad" : "default"}>{batch.status}</StatusBadge>
                </td>
                <td className="px-3 py-3">{batch.totalRows}</td>
                <td className="px-3 py-3">{batch.validRows}</td>
                <td className="px-3 py-3">{batch.invalidRows}</td>
                <td className="px-3 py-3">{batch.duplicateRows}</td>
                <td className="px-3 py-3">{batch.importedRows}</td>
                <td className="max-w-[160px] truncate px-3 py-3 text-xs text-muted-foreground">{batch.filename ?? "-"}</td>
                <td className="px-3 py-3">{formatDate(batch.createdAt)}</td>
              </tr>
            ))}
          </DataTable>
        </TableShell>
      )}

      {latestIssues.length > 0 ? (
        <Panel className="mt-4">
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Últimas pendências ({latest?.entity})</h2>
          <ul className="space-y-1 text-sm">
            {latestIssues.map((issue) => (
              <li key={issue.line} className="text-muted-foreground">
                Linha {issue.line}: <span className="text-foreground/80">{issue.status}</span>
                {issue.errors && issue.errors.length > 0 ? ` — ${issue.errors.join("; ")}` : ""}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
