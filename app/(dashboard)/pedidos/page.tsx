import { Archive, RotateCcw, Save } from "lucide-react"

import { archiveOrderAction, createOrderAction, restoreOrderAction, transitionOrderAction, updateOrderAction } from "./actions"
import { EmptyState, PageHeader, Pagination, Panel, SearchFilter, StatusBadge, TableShell, DataTable } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { formatDate } from "@/lib/admin/display"
import { formatMoney } from "@/lib/admin/money"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { grossProfit, orderTransitions } from "@/lib/admin/status"
import { ORDER_STATUSES } from "@/lib/types"
import { customersService } from "@/lib/services/customers-service"
import { ordersService } from "@/lib/services/orders-service"

export const dynamic = "force-dynamic"

const statusOptions = ORDER_STATUSES.map((status) => ({ value: status, label: status }))

export default async function OrdersPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("orders", "read")
  const params = await readSearchParams(searchParams)
  const [result, customers] = await Promise.all([
    ordersService.list(params),
    customersService.list({ pageSize: "100" }),
  ])
  const canCreate = can(actor.role, "orders", "create")
  const canManage = can(actor.role, "orders", "manage")
  const canUpdate = can(actor.role, "orders", "update")
  const canArchive = can(actor.role, "orders", "archive")

  return (
    <div>
      <PageHeader title="Pedidos" description="Pedidos reais com transições controladas e cálculo monetário sem float." />
      {canCreate ? (
        <Panel className="mb-4">
          <form action={createOrderAction} className="grid gap-3 md:grid-cols-[180px_1fr_110px_110px_110px_90px_auto]">
            <select name="customerId" required className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
              <option value="">Cliente</option>
              {customers.data.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <input name="description" placeholder="Descrição" required className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="creditAmount" defaultValue="0.00" placeholder="Créditos" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="salePrice" defaultValue="0.00" placeholder="Venda" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="costPrice" defaultValue="0.00" placeholder="Custo" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input name="currency" defaultValue="USD" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
            <input type="hidden" name="status" value="draft" />
            <Button type="submit">
              <Save className="size-4" />
              Criar
            </Button>
          </form>
        </Panel>
      ) : null}

      <SearchFilter placeholder="Buscar pedido ou cliente" statusOptions={[...statusOptions, { value: "archived", label: "archived" }]} />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Pedido", "Cliente", "Status", "Receita", "Custo", "Lucro", "Datas", "Ações"]}>
              {result.data.map((order) => (
                <tr key={order.id} className="align-top">
                  <td className="px-3 py-3">{order.description}</td>
                  <td className="px-3 py-3">{order.customerName}</td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={order.status === "delivered" ? "good" : order.status === "cancelled" || order.status === "refunded" ? "bad" : "warn"}>
                      {order.status}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">{formatMoney(order.salePrice, order.currency)}</td>
                  <td className="px-3 py-3">{formatMoney(order.costPrice, order.currency)}</td>
                  <td className="px-3 py-3">{formatMoney(grossProfit(order.salePrice, order.costPrice), order.currency)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    Pago: {formatDate(order.paidAt)}
                    <br />
                    Entregue: {formatDate(order.deliveredAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canUpdate ? (
                        <form action={transitionOrderAction} className="flex gap-1">
                          <input type="hidden" name="id" value={order.id} />
                          <select name="status" defaultValue="" className="h-8 rounded-lg border border-border bg-background/70 px-2 text-xs">
                            <option value="" disabled>
                              status
                            </option>
                            {(canManage ? ORDER_STATUSES : orderTransitions[order.status]).map((status) => (
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
                      {canManage ? (
                        <form action={updateOrderAction}>
                          <input type="hidden" name="id" value={order.id} />
                          <input type="hidden" name="customerId" value={order.customerId} />
                          <input type="hidden" name="description" value={order.description} />
                          <input type="hidden" name="creditAmount" value={order.creditAmount} />
                          <input type="hidden" name="salePrice" value={order.salePrice} />
                          <input type="hidden" name="costPrice" value={order.costPrice} />
                          <input type="hidden" name="currency" value={order.currency} />
                          <input type="hidden" name="status" value={order.status} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Salvar">
                            <Save className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canArchive && !order.archivedAt ? (
                        <form action={archiveOrderAction}>
                          <input type="hidden" name="id" value={order.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Arquivar">
                            <Archive className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage && order.archivedAt ? (
                        <form action={restoreOrderAction}>
                          <input type="hidden" name="id" value={order.id} />
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
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/pedidos" />
        </>
      )}
    </div>
  )
}
