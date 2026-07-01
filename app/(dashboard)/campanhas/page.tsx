import { Archive, RotateCcw, Save } from "lucide-react"

import { archiveCampaignAction, createCampaignAction, restoreCampaignAction, updateCampaignAction } from "./actions"
import { EmptyState, PageHeader, Pagination, Panel, SearchFilter, StatusBadge, TableShell, DataTable } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { formatMoney } from "@/lib/admin/money"
import { safeText } from "@/lib/admin/display"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { campaignsService } from "@/lib/services/campaigns-service"

export const dynamic = "force-dynamic"

const statuses = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
  { value: "archived", label: "Arquivada" },
]

export default async function CampaignsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("campaigns", "read")
  const params = await readSearchParams(searchParams)
  const result = await campaignsService.list(params)
  const canCreate = can(actor.role, "campaigns", "create")
  const canUpdate = can(actor.role, "campaigns", "update")
  const canArchive = can(actor.role, "campaigns", "archive")

  return (
    <div>
      <PageHeader title="Campanhas" description="CRUD real de campanhas. URLs são armazenadas e validadas, nunca acessadas automaticamente." />
      {canCreate ? (
        <Panel className="mb-4">
          <form action={createCampaignAction} className="grid gap-3 md:grid-cols-[1fr_140px_1fr_120px_100px_auto]">
            <input name="name" placeholder="Nome" required className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="platform" placeholder="Plataforma" required className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="referralUrl" placeholder="Referral URL" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="rewardPerConversion" defaultValue="0.00" placeholder="Recompensa" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="currency" defaultValue="USD" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input type="hidden" name="monthlyLimit" value="" />
            <input type="hidden" name="termsUrl" value="" />
            <input type="hidden" name="notes" value="" />
            <input type="hidden" name="active" value="true" />
            <Button type="submit">
              <Save className="size-4" />
              Criar
            </Button>
          </form>
        </Panel>
      ) : null}

      <SearchFilter placeholder="Buscar campanha ou plataforma" statusOptions={statuses} />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Campanha", "Plataforma", "Status", "Recompensa", "Limite", "Notas", "Ações"]}>
              {result.data.map((campaign) => (
                <tr key={campaign.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{campaign.name}</div>
                    <div className="max-w-[280px] truncate text-xs text-muted-foreground">{safeText(campaign.referralUrl)}</div>
                  </td>
                  <td className="px-3 py-3">{campaign.platform}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={campaign.archivedAt ? "default" : campaign.active ? "good" : "warn"}>
                      {campaign.archivedAt ? "archived" : campaign.active ? "active" : "inactive"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">{formatMoney(campaign.rewardPerConversion, campaign.currency)}</td>
                  <td className="px-3 py-3">{campaign.monthlyLimit ?? "-"}</td>
                  <td className="px-3 py-3">{safeText(campaign.notes)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate ? (
                        <form action={updateCampaignAction} className="flex gap-1">
                          <input type="hidden" name="id" value={campaign.id} />
                          <input type="hidden" name="name" value={campaign.name} />
                          <input type="hidden" name="platform" value={campaign.platform} />
                          <input type="hidden" name="referralUrl" value={campaign.referralUrl ?? ""} />
                          <input type="hidden" name="rewardPerConversion" value={campaign.rewardPerConversion} />
                          <input type="hidden" name="monthlyLimit" value={campaign.monthlyLimit ?? ""} />
                          <input type="hidden" name="currency" value={campaign.currency} />
                          <input type="hidden" name="termsUrl" value={campaign.termsUrl ?? ""} />
                          <input type="hidden" name="notes" value={campaign.notes ?? ""} />
                          <select name="active" defaultValue={campaign.active ? "true" : "false"} className="h-8 rounded-lg border border-border bg-background/70 px-2 text-xs">
                            <option value="true">active</option>
                            <option value="false">inactive</option>
                          </select>
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Salvar">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canArchive && !campaign.archivedAt ? (
                        <form action={archiveCampaignAction}>
                          <input type="hidden" name="id" value={campaign.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Arquivar">
                            <Archive className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canUpdate && campaign.archivedAt ? (
                        <form action={restoreCampaignAction}>
                          <input type="hidden" name="id" value={campaign.id} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Restaurar">
                            <RotateCcw className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </TableShell>
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/campanhas" />
        </>
      )}
    </div>
  )
}
