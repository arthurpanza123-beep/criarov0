import { requirePermission } from "@/lib/auth/session"
import { getDashboardMetrics } from "@/lib/services/dashboard-service"
import { formatMoney } from "@/lib/admin/money"
import { formatDate } from "@/lib/admin/display"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { EmptyState, MetricCard, PageHeader, Panel } from "@/components/admin/primitives"

export const dynamic = "force-dynamic"

export default async function DashboardPage({ searchParams }: { searchParams?: PageSearchParams }) {
  await requirePermission("dashboard", "read")
  const params = await readSearchParams(searchParams)
  const metrics = await getDashboardMetrics({
    range: params.range,
    from: params.from,
    to: params.to,
  })

  const hasData =
    metrics.accounts.active +
      metrics.accounts.inactive +
      metrics.accounts.archived +
      metrics.campaigns.active +
      metrics.referrals.pending +
      metrics.referrals.approved +
      metrics.customers.active +
      metrics.orders.pending +
      metrics.orders.delivered >
    0

  return (
    <div>
      <PageHeader title="Dashboard" description="Métricas calculadas diretamente do PostgreSQL.">
        <form className="flex flex-wrap gap-2">
          <select
            name="range"
            defaultValue={metrics.range.range}
            className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
          >
            <option value="today">Hoje</option>
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="month">Mês atual</option>
            <option value="custom">Personalizado</option>
          </select>
          <input name="from" type="date" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary" />
          <input name="to" type="date" className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary" />
          <button className="h-9 rounded-lg border border-border bg-background px-3 text-sm">Aplicar</button>
        </form>
      </PageHeader>

      {!hasData ? (
        <EmptyState>Sem dados administrativos ainda. As métricas permanecem zeradas até que registros reais sejam criados.</EmptyState>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Contas ativas" value={metrics.accounts.active} detail={`${metrics.accounts.inactive} inativas`} />
        <MetricCard label="Contas arquivadas" value={metrics.accounts.archived} />
        <MetricCard label="Limite mensal" value={formatMoney(metrics.accounts.monthlyLimit)} />
        <MetricCard label="Saldo confirmado" value={formatMoney(metrics.ledger.confirmedBalance)} />
        <MetricCard label="Consumido no período" value={formatMoney(metrics.ledger.spentInPeriod)} />
        <MetricCard label="Campanhas ativas" value={metrics.campaigns.active} />
        <MetricCard label="Indicações pendentes" value={metrics.referrals.pending} />
        <MetricCard label="Indicações aprovadas" value={metrics.referrals.approved} />
        <MetricCard label="Recompensas aprovadas" value={formatMoney(metrics.referrals.approvedRewards)} />
        <MetricCard label="Clientes ativos" value={metrics.customers.active} />
        <MetricCard label="Pedidos pendentes" value={metrics.orders.pending} />
        <MetricCard label="Pedidos entregues" value={metrics.orders.delivered} />
        <MetricCard label="Receita confirmada" value={formatMoney(metrics.orders.revenue)} />
        <MetricCard label="Custo confirmado" value={formatMoney(metrics.orders.cost)} />
        <MetricCard label="Lucro bruto" value={formatMoney(metrics.orders.grossProfit)} />
      </div>

      <Panel className="mt-5">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Atividades recentes</h2>
        {metrics.recentActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
        ) : (
          <div className="divide-y divide-border">
            {metrics.recentActivities.map((activity) => (
              <div key={activity.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-foreground/85">
                  {activity.action} <span className="text-muted-foreground">em {activity.entityType}</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">{formatDate(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
