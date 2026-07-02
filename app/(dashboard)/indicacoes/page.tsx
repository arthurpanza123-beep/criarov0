import { Archive, CheckCircle2, RotateCcw, Save } from "lucide-react"

import {
  approveReferralAction,
  archiveReferralAction,
  createReferralFormAction,
  restoreReferralAction,
  transitionReferralAction,
  updateReferralAction,
} from "./actions"
import { ActionForm } from "@/components/admin/action-form"
import { EmptyState, PageHeader, Pagination, Panel, SearchFilter, StatusBadge, TableShell, DataTable } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { formatMoney } from "@/lib/admin/money"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { referralTransitions } from "@/lib/admin/status"
import { REFERRAL_STATUSES } from "@/lib/types"
import { campaignsService } from "@/lib/services/campaigns-service"
import { referralsService } from "@/lib/services/referrals-service"

export const dynamic = "force-dynamic"

const statusOptions = REFERRAL_STATUSES.map((status) => ({ value: status, label: status }))

export default async function ReferralsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("referrals", "read")
  const params = await readSearchParams(searchParams)
  const [result, campaigns] = await Promise.all([
    referralsService.list(params),
    campaignsService.list({ pageSize: "100" }),
  ])
  const canCreate = can(actor.role, "referrals", "create")
  const canManage = can(actor.role, "referrals", "manage")
  const canUpdate = can(actor.role, "referrals", "update")
  const canArchive = can(actor.role, "referrals", "archive")

  return (
    <div>
      <PageHeader title="Indicações" description="Fluxo real de indicações. Aprovação não cria ledger automático sem conta gerenciada associada." />
      {canCreate ? (
        <Panel className="mb-4">
          <ActionForm
            action={createReferralFormAction}
            successMessage="Indicação criada."
            className="grid gap-3 md:grid-cols-[180px_1fr_1fr_130px_110px_auto]"
            submitLabel="Criar"
            submitIcon={<Save className="size-4" />}
          >
            <select name="campaignId" required className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
              <option value="">Campanha</option>
              {campaigns.data.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
            <input name="contactName" placeholder="Contato" required className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="contactEmail" type="email" placeholder="E-mail" className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="contactPhone" placeholder="Telefone" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="expectedReward" defaultValue="0.00" placeholder="Recompensa" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input type="hidden" name="status" value="pending" />
          </ActionForm>
        </Panel>
      ) : null}

      <SearchFilter placeholder="Buscar indicação ou campanha" statusOptions={statusOptions} />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Contato", "Campanha", "Status", "Esperado", "Aprovado", "Ações"]}>
              {result.data.map((referral) => (
                <tr key={referral.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{referral.contactName}</div>
                    <div className="text-xs text-muted-foreground">{referral.contactEmail ?? referral.contactPhone ?? "-"}</div>
                  </td>
                  <td className="px-3 py-3">{referral.campaignName}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={referral.status === "approved" ? "good" : referral.status === "rejected" ? "bad" : "warn"}>
                      {referral.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">{formatMoney(referral.expectedReward)}</td>
                  <td className="px-3 py-3">{formatMoney(referral.approvedReward ?? "0")}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate ? (
                        <form action={transitionReferralAction} className="flex gap-1">
                          <input type="hidden" name="id" value={referral.id} />
                          <select name="status" defaultValue="" className="h-8 rounded-lg border border-border bg-background/70 px-2 text-xs">
                            <option value="" disabled>
                              status
                            </option>
                            {(canManage ? REFERRAL_STATUSES : referralTransitions[referral.status]).map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Alterar status">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canUpdate && referral.status !== "approved" ? (
                        <form action={approveReferralAction} className="flex gap-1">
                          <input type="hidden" name="id" value={referral.id} />
                          <input name="approvedReward" defaultValue={referral.expectedReward} className="h-8 w-24 rounded-lg border border-border bg-background/70 px-2 text-xs" />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Aprovar">
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage ? (
                        <form action={updateReferralAction}>
                          <input type="hidden" name="id" value={referral.id} />
                          <input type="hidden" name="campaignId" value={referral.campaignId} />
                          <input type="hidden" name="contactName" value={referral.contactName} />
                          <input type="hidden" name="contactEmail" value={referral.contactEmail ?? ""} />
                          <input type="hidden" name="contactPhone" value={referral.contactPhone ?? ""} />
                          <input type="hidden" name="status" value={referral.status} />
                          <input type="hidden" name="expectedReward" value={referral.expectedReward} />
                          <input type="hidden" name="approvedReward" value={referral.approvedReward ?? ""} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Salvar">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canArchive && !referral.archivedAt ? (
                        <form action={archiveReferralAction}>
                          <input type="hidden" name="id" value={referral.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Arquivar">
                            <Archive className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage && referral.archivedAt ? (
                        <form action={restoreReferralAction}>
                          <input type="hidden" name="id" value={referral.id} />
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
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/indicacoes" />
        </>
      )}
    </div>
  )
}
