import { Download } from "lucide-react"

import { PageHeader, Panel } from "@/components/admin/primitives"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { EXPORT_ENTITIES, exportResource } from "@/lib/services/export-service"

export const dynamic = "force-dynamic"

const labels: Record<string, string> = {
  managed_accounts: "Contas gerenciadas",
  campaigns: "Campanhas",
  customers: "Clientes",
  orders: "Pedidos",
  credit_ledger: "Ledger de créditos",
}

export default async function ExportsPage() {
  const actor = await requirePermission("dashboard", "read")
  const allowed = EXPORT_ENTITIES.filter((entity) => can(actor.role, exportResource[entity], "read"))

  return (
    <div>
      <PageHeader
        title="Exportações"
        description="Exportação CSV autorizada. Cada download exige permissão de leitura da entidade e é registrado como atividade."
      />
      {allowed.length === 0 ? (
        <p className="text-sm text-muted-foreground">Seu papel não tem permissão de leitura para exportar entidades.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {allowed.map((entity) => (
            <Panel key={entity} className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{labels[entity] ?? entity}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{entity}.csv</p>
              </div>
              <a
                href={`/api/export/${entity}`}
                download
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-primary px-3 text-sm text-primary-foreground transition hover:opacity-90"
              >
                <Download className="size-4" />
                Baixar
              </a>
            </Panel>
          ))}
        </div>
      )}
    </div>
  )
}
