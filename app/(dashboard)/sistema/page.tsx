import { sql } from "drizzle-orm"

import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/admin/primitives"
import { requirePermission } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { versionInfo } from "@/lib/observability/version"
import { queueHealth } from "@/lib/services/jobs-service"

export const dynamic = "force-dynamic"

export default async function SystemPage() {
  await requirePermission("system", "read")
  const version = versionInfo()

  let databaseOk = true
  try {
    await getDb().execute(sql`select 1`)
  } catch {
    databaseOk = false
  }

  let queue: Awaited<ReturnType<typeof queueHealth>> | null = null
  try {
    queue = await queueHealth()
  } catch {
    queue = null
  }

  return (
    <div>
      <PageHeader
        title="Saúde do sistema"
        description="Observabilidade interna: banco, fila, versão e commit. Nenhum segredo, token, cookie ou URL de banco é exposto."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Banco de dados</p>
          <div className="mt-2">
            <StatusBadge tone={databaseOk ? "good" : "bad"}>{databaseOk ? "reachable" : "unreachable"}</StatusBadge>
          </div>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Fila</p>
          <div className="mt-2">
            <StatusBadge tone={queue ? (queue.deadLetter > 0 ? "warn" : "good") : "bad"}>{queue ? "operacional" : "indisponível"}</StatusBadge>
          </div>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Versão</p>
          <p className="mt-2 font-mono text-sm">{version.version}</p>
          <p className="font-mono text-[10px] text-muted-foreground">commit {version.commit}</p>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Ambiente</p>
          <p className="mt-2 font-mono text-sm">{version.env}</p>
          <p className="font-mono text-[10px] text-muted-foreground">node {version.node}</p>
        </Panel>
      </div>

      {queue ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <MetricCard label="Pendentes" value={queue.pending} />
          <MetricCard label="Executando" value={queue.running} />
          <MetricCard label="Falhas" value={queue.failed} />
          <MetricCard label="Dead-letter" value={queue.deadLetter} />
          <MetricCard label="Pendente mais antigo" value={`${Math.round(queue.oldestPendingMs / 1000)}s`} />
        </div>
      ) : null}

      <Panel className="mt-5">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Operação</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Métricas protegidas em JSON: <span className="font-mono text-foreground/80">/api/metrics</span> (owner/admin).</li>
          <li>Readiness: <span className="font-mono text-foreground/80">/api/health/ready</span> · Versão: <span className="font-mono text-foreground/80">/api/version</span>.</li>
          <li>Worker de fila: <span className="font-mono text-foreground/80">pnpm worker</span> (processa jobs com backoff, timeout e dead-letter).</li>
        </ul>
      </Panel>
    </div>
  )
}
