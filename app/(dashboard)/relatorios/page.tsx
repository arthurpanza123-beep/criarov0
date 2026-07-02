import { MetricCard, PageHeader, Panel } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { formatMoney } from "@/lib/admin/money"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { requirePermission } from "@/lib/auth/session"
import { getSimulatorReport } from "@/lib/services/simulator-service"

export const dynamic = "force-dynamic"

const pct = (value: number) => `${(value * 100).toFixed(1)}%`

export default async function ReportsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  await requirePermission("reports", "read")
  const params = await readSearchParams(searchParams)
  const failureRate = Math.min(Math.max(Number(params.failureRate) || 0, 0), 1)
  const periodMonths = Math.min(Math.max(Math.floor(Number(params.periodMonths) || 1), 1), 60)
  const report = await getSimulatorReport({ failureRate, periodMonths })

  return (
    <div>
      <PageHeader
        title="Relatórios & simulador"
        description="Cálculos financeiros baseados no ledger confirmado e nas configurações. Dinheiro em centavos/BigInt, sem float. Não executa cadastros nem acessa serviços externos."
      >
        <form className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Taxa de falha (0–1)
            <input name="failureRate" type="number" step="0.05" min="0" max="1" defaultValue={String(failureRate)} className="h-9 w-28 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Período (meses)
            <input name="periodMonths" type="number" min="1" max="60" defaultValue={String(periodMonths)} className="h-9 w-28 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none" />
          </label>
          <Button type="submit" variant="outline">Recalcular</Button>
        </form>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        <MetricCard label="Contas ativas" value={report.accounts.active} />
        <MetricCard label="Limite mensal total" value={formatMoney(report.capacity.totalMonthlyLimit)} />
        <MetricCard label="Capacidade usada" value={formatMoney(report.capacity.used)} />
        <MetricCard label="Capacidade disponível" value={formatMoney(report.capacity.available)} detail={`Utilização ${pct(report.capacity.utilization)}`} />
        <MetricCard label="Saldo confirmado" value={formatMoney(report.balance.confirmed)} />
        <MetricCard label="Consumido" value={formatMoney(report.balance.spent)} />
        <MetricCard label="Receita" value={formatMoney(report.finance.revenue)} />
        <MetricCard label="Custo" value={formatMoney(report.finance.cost)} />
        <MetricCard label="Lucro bruto" value={formatMoney(report.finance.grossProfit)} detail={`Margem ${pct(report.finance.margin)}`} />
        <MetricCard label="Pedidos entregues" value={report.finance.deliveredOrders} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Cenário com taxa de falha {pct(report.scenario.failureRate)}</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Receita efetiva</dt><dd>{formatMoney(report.scenario.effectiveRevenue)}</dd>
            <dt className="text-muted-foreground">Lucro</dt><dd>{formatMoney(report.scenario.profit)}</dd>
            <dt className="text-muted-foreground">Margem</dt><dd>{pct(report.scenario.margin)}</dd>
          </dl>
        </Panel>
        <Panel>
          <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Projeção ({report.projection.periodMonths} meses)</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Receita projetada</dt><dd>{formatMoney(report.projection.revenue)}</dd>
            <dt className="text-muted-foreground">Lucro projetado</dt><dd>{formatMoney(report.projection.profit)}</dd>
          </dl>
        </Panel>
      </div>
    </div>
  )
}
