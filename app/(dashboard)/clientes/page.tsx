import { Archive, RotateCcw, Save } from "lucide-react"

import { archiveCustomerAction, createCustomerAction, restoreCustomerAction, updateCustomerAction } from "./actions"
import { EmptyState, PageHeader, Pagination, Panel, SearchFilter, TableShell, DataTable } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { safeText } from "@/lib/admin/display"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { customersService } from "@/lib/services/customers-service"

export const dynamic = "force-dynamic"

export default async function CustomersPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("customers", "read")
  const params = await readSearchParams(searchParams)
  const result = await customersService.list(params)
  const canCreate = can(actor.role, "customers", "create")
  const canManage = can(actor.role, "customers", "manage")
  const canArchive = can(actor.role, "customers", "archive")

  return (
    <div>
      <PageHeader title="Clientes" description="Clientes reais associados aos pedidos. E-mail é opcional quando o schema permite." />
      {canCreate ? (
        <Panel className="mb-4">
          <form action={createCustomerAction} className="grid gap-3 md:grid-cols-[1fr_1fr_150px_1fr_auto]">
            <input name="name" placeholder="Nome" required className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="email" type="email" placeholder="E-mail" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="phone" placeholder="Telefone" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="notes" placeholder="Notas" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <Button type="submit">
              <Save className="size-4" />
              Criar
            </Button>
          </form>
        </Panel>
      ) : null}

      <SearchFilter placeholder="Buscar cliente, e-mail ou telefone" statusOptions={[{ value: "archived", label: "Arquivados" }]} />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Cliente", "E-mail", "Telefone", "Notas", "Ações"]}>
              {result.data.map((customer) => (
                <tr key={customer.id} className="align-top">
                  <td className="px-3 py-3 font-medium">{customer.name}</td>
                  <td className="px-3 py-3">{safeText(customer.email)}</td>
                  <td className="px-3 py-3">{safeText(customer.phone)}</td>
                  <td className="px-3 py-3">{safeText(customer.notes)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canManage ? (
                        <form action={updateCustomerAction}>
                          <input type="hidden" name="id" value={customer.id} />
                          <input type="hidden" name="name" value={customer.name} />
                          <input type="hidden" name="email" value={customer.email ?? ""} />
                          <input type="hidden" name="phone" value={customer.phone ?? ""} />
                          <input type="hidden" name="notes" value={customer.notes ?? ""} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Salvar">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canArchive && !customer.archivedAt ? (
                        <form action={archiveCustomerAction}>
                          <input type="hidden" name="id" value={customer.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Arquivar">
                            <Archive className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage && customer.archivedAt ? (
                        <form action={restoreCustomerAction}>
                          <input type="hidden" name="id" value={customer.id} />
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
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/clientes" />
        </>
      )}
    </div>
  )
}
