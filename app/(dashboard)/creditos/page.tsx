import { Ban, CheckCircle2, Save } from "lucide-react"

import { cancelCreditLedgerAction, confirmCreditLedgerAction, createCreditLedgerFormAction } from "./actions"
import { ActionForm } from "@/components/admin/action-form"
import { EmptyState, PageHeader, Pagination, Panel, SearchFilter, StatusBadge, TableShell, DataTable } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { formatDate, safeText } from "@/lib/admin/display"
import { formatMoney } from "@/lib/admin/money"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { CREDIT_LEDGER_STATUSES, CREDIT_LEDGER_TYPES } from "@/lib/types"
import { creditLedgerService } from "@/lib/services/credit-ledger-service"
import { managedAccountsService } from "@/lib/services/managed-accounts-service"

export const dynamic = "force-dynamic"

export default async function CreditLedgerPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("creditLedger", "read")
  const params = await readSearchParams(searchParams)
  const [result, accounts] = await Promise.all([
    creditLedgerService.list(params),
    managedAccountsService.list({ pageSize: "100" }),
  ])
  const canCreate = can(actor.role, "creditLedger", "create")
  const canManage = can(actor.role, "creditLedger", "manage")

  return (
    <div>
      <PageHeader title="Créditos" description="Ledger confirmado é a fonte para cálculo de saldo. Lançamentos não são apagados." />
      {canCreate ? (
        <Panel className="mb-4">
          <ActionForm
            action={createCreditLedgerFormAction}
            successMessage="Lançamento criado."
            className="grid gap-3 md:grid-cols-[180px_110px_110px_90px_1fr_auto]"
            submitLabel="Criar"
            submitIcon={<Save className="size-4" />}
          >
            <select name="managedAccountId" required className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
              <option value="">Conta</option>
              {accounts.data.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
            <select name="type" defaultValue="adjustment" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
              {CREDIT_LEDGER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <input name="amount" defaultValue="0.00" className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="currency" defaultValue="USD" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="description" placeholder="Descrição" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input type="hidden" name="status" value="pending" />
            <input type="hidden" name="campaignId" value="" />
            <input type="hidden" name="referralId" value="" />
          </ActionForm>
        </Panel>
      ) : null}

      <SearchFilter placeholder="Buscar lançamento, conta ou campanha" statusOptions={CREDIT_LEDGER_STATUSES.map((status) => ({ value: status, label: status }))} />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Data", "Conta", "Origem", "Tipo", "Valor", "Status", "Descrição", "Ações"]}>
              {result.data.map((entry) => (
                <tr key={entry.id} className="align-top">
                  <td className="px-3 py-3">{formatDate(entry.occurredAt)}</td>
                  <td className="px-3 py-3">{entry.managedAccountLabel}</td>
                  <td className="px-3 py-3">{entry.campaignName ?? "-"}</td>
                  <td className="px-3 py-3">{entry.type}</td>
                  <td className="px-3 py-3">{formatMoney(entry.amount, entry.currency)}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={entry.status === "confirmed" ? "good" : entry.status === "cancelled" ? "bad" : "warn"}>
                      {entry.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">{safeText(entry.description)}</td>
                  <td className="px-3 py-3">
                    {canManage && entry.status === "pending" ? (
                      <div className="flex gap-2">
                        <form action={confirmCreditLedgerAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Confirmar">
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        </form>
                        <form action={cancelCreditLedgerAction}>
                          <input type="hidden" name="id" value={entry.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Cancelar">
                            <Ban className="size-3.5" />
                          </Button>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Histórico</span>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </TableShell>
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/creditos" />
        </>
      )}
    </div>
  )
}
