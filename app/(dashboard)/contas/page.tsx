import { Archive, RotateCcw, Save, Scale } from "lucide-react"

import {
  archiveManagedAccountAction,
  createManagedAccountFormAction,
  reconcileManagedAccountAction,
  restoreManagedAccountAction,
  updateManagedAccountAction,
  updateManagedAccountStatusAction,
} from "./actions"
import { ActionForm } from "@/components/admin/action-form"
import { EmptyState, PageHeader, Pagination, Panel, SearchFilter, StatusBadge, TableShell, DataTable } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { formatDate, safeText } from "@/lib/admin/display"
import { formatMoney } from "@/lib/admin/money"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { managedAccountsService } from "@/lib/services/managed-accounts-service"

export const dynamic = "force-dynamic"

const statuses = [
  { value: "active", label: "Ativa" },
  { value: "inactive", label: "Inativa" },
  { value: "suspended", label: "Suspensa" },
  { value: "archived", label: "Arquivada" },
]

export default async function AccountsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("managedAccounts", "read")
  const params = await readSearchParams(searchParams)
  const result = await managedAccountsService.list(params)
  const canCreate = can(actor.role, "managedAccounts", "create")
  const canManage = can(actor.role, "managedAccounts", "manage")
  const canUpdate = can(actor.role, "managedAccounts", "update")

  return (
    <div>
      <PageHeader title="Contas gerenciadas" description="Contas administrativas sem senhas, cookies ou tokens externos." />
      {canCreate ? (
        <Panel className="mb-4">
          <ActionForm
            action={createManagedAccountFormAction}
            successMessage="Conta criada."
            className="grid gap-3 md:grid-cols-[1fr_1fr_140px_140px_1fr_auto]"
            submitLabel="Criar"
            submitIcon={<Save className="size-4" />}
          >
            <input name="label" placeholder="Nome" required className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="email" type="email" placeholder="E-mail" required className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="provider" placeholder="Provider" required className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="monthlyCreditLimit" placeholder="Limite" defaultValue="0.00" className="h-9 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="notes" placeholder="Notas" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input type="hidden" name="status" value="active" />
            <input type="hidden" name="lastCheckedAt" value="" />
          </ActionForm>
        </Panel>
      ) : null}

      <SearchFilter placeholder="Buscar conta, e-mail ou provider" statusOptions={statuses} />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Conta", "Provider", "Status", "Saldo", "Limite", "Última checagem", "Ações"]}>
              {result.data.map((account) => (
                <tr key={account.id} className="align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium">{account.label}</div>
                    <div className="text-xs text-muted-foreground">{account.email}</div>
                    <div className="text-xs text-muted-foreground">{safeText(account.notes)}</div>
                  </td>
                  <td className="px-3 py-3">{account.provider}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={account.status === "active" ? "good" : account.status === "suspended" ? "bad" : "default"}>
                      {account.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">{formatMoney(account.creditBalance)}</td>
                  <td className="px-3 py-3">{formatMoney(account.monthlyCreditLimit)}</td>
                  <td className="px-3 py-3">{formatDate(account.lastCheckedAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate && !canManage ? (
                        <form action={updateManagedAccountStatusAction} className="flex gap-1">
                          <input type="hidden" name="id" value={account.id} />
                          <select name="status" defaultValue={account.status === "archived" ? "inactive" : account.status} className="h-8 rounded-lg border border-border bg-background/70 px-2 text-xs">
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                            <option value="suspended">suspended</option>
                          </select>
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Atualizar status">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage ? (
                        <form action={updateManagedAccountAction} className="flex flex-wrap gap-1">
                          <input type="hidden" name="id" value={account.id} />
                          <input type="hidden" name="label" value={account.label} />
                          <input type="hidden" name="email" value={account.email} />
                          <input type="hidden" name="provider" value={account.provider} />
                          <input type="hidden" name="monthlyCreditLimit" value={account.monthlyCreditLimit} />
                          <input type="hidden" name="notes" value={account.notes ?? ""} />
                          <input type="hidden" name="lastCheckedAt" value="" />
                          <select name="status" defaultValue={account.status === "archived" ? "inactive" : account.status} className="h-8 rounded-lg border border-border bg-background/70 px-2 text-xs">
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                            <option value="suspended">suspended</option>
                          </select>
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Salvar">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage ? (
                        <form action={reconcileManagedAccountAction}>
                          <input type="hidden" name="id" value={account.id} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Reconciliar saldo">
                            <Scale className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {can(actor.role, "managedAccounts", "archive") && !account.archivedAt ? (
                        <form action={archiveManagedAccountAction}>
                          <input type="hidden" name="id" value={account.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Arquivar">
                            <Archive className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage && account.archivedAt ? (
                        <form action={restoreManagedAccountAction}>
                          <input type="hidden" name="id" value={account.id} />
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
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/contas" />
        </>
      )}
    </div>
  )
}
