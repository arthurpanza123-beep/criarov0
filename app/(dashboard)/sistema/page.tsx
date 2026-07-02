import { sql } from "drizzle-orm"

import { MetricCard, PageHeader, Panel, StatusBadge } from "@/components/admin/primitives"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { versionInfo } from "@/lib/observability/version"
import { queueHealth } from "@/lib/services/jobs-service"
import { getLastMonitorReport, type CheckSeverity } from "@/lib/services/monitoring-service"

export const dynamic = "force-dynamic"

const severityTone: Record<CheckSeverity, "good" | "warn" | "bad"> = {
  ok: "good",
  warn: "warn",
  critical: "bad",
}

const severityLabel: Record<CheckSeverity, string> = {
  ok: "ok",
  warn: "atenção",
  critical: "crítico",
}

function formatAgo(ms: number | undefined) {
  if (ms === undefined || Number.isNaN(ms)) return "-"
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s atrás`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.round(minutes / 60)
  return `${hours}h atrás`
}

/** Wraps the impure Date.now() read in its own function so the page component
 * itself stays lint-clean under react-hooks/purity, even though this is a
 * Server Component (async function) with no client-side re-render concern. */
function msSince(iso: string) {
  return Date.now() - new Date(iso).getTime()
}

function formatBytes(bytes: number | undefined) {
  if (bytes === undefined || Number.isNaN(bytes)) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default async function SystemPage() {
  const actor = await requirePermission("system", "read")
  const canManage = can(actor.role, "system", "manage")
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

  const monitor = await getLastMonitorReport().catch(() => null)
  const monitorAgeMs = monitor ? msSince(monitor.generatedAt) : undefined
  const backupCheck = monitor?.checks.find((check) => check.name === "backup")
  const workerCheck = monitor?.checks.find((check) => check.name === "worker")
  const diskCheck = monitor?.checks.find((check) => check.name === "disk")
  const stuckCheck = monitor?.checks.find((check) => check.name === "stuck_jobs")

  return (
    <div>
      <PageHeader
        title="Saúde do sistema"
        description="Observabilidade interna: banco, fila, worker, backup, disco, versão e commit. Nenhum segredo, token, cookie ou URL de banco é exposto."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Banco de dados</p>
          <div className="mt-2">
            <StatusBadge tone={databaseOk ? "good" : "bad"}>{databaseOk ? "reachable" : "unreachable"}</StatusBadge>
          </div>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Worker</p>
          <div className="mt-2">
            <StatusBadge tone={workerCheck ? severityTone[workerCheck.severity] : "default"}>
              {workerCheck ? severityLabel[workerCheck.severity] : "sem dados"}
            </StatusBadge>
          </div>
          {workerCheck?.detail?.ageMs !== undefined ? (
            <p className="mt-1 text-xs text-muted-foreground">heartbeat {formatAgo(workerCheck.detail.ageMs as number)}</p>
          ) : null}
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

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Backup</h2>
            {backupCheck ? (
              <StatusBadge tone={severityTone[backupCheck.severity]}>{severityLabel[backupCheck.severity]}</StatusBadge>
            ) : null}
          </div>
          {backupCheck ? (
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>{backupCheck.message}</p>
              <p className="text-xs">Idade: {formatAgo(backupCheck.detail?.ageMs as number | undefined)}</p>
              {canManage && backupCheck.detail?.error ? (
                <p className="text-xs text-destructive">Erro: {String(backupCheck.detail.error)}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nenhum backup registrado ainda.</p>
          )}
          {canManage ? (
            <p className="mt-3 font-mono text-[10px] text-muted-foreground/70">
              Diário 03:15 UTC · retenção 7 diários / 4 semanais / 6 mensais · checksum SHA-256.
            </p>
          ) : null}
        </Panel>

        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Disco</h2>
            {diskCheck ? <StatusBadge tone={severityTone[diskCheck.severity]}>{severityLabel[diskCheck.severity]}</StatusBadge> : null}
          </div>
          {diskCheck ? (
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              <p>{diskCheck.message}</p>
              {diskCheck.detail?.freeBytes !== undefined ? (
                <p className="text-xs">
                  Livre: {formatBytes(diskCheck.detail.freeBytes as number)} de {formatBytes(diskCheck.detail.totalBytes as number)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Sem dados de monitoramento ainda.</p>
          )}
        </Panel>
      </div>

      {stuckCheck && stuckCheck.severity !== "ok" ? (
        <Panel className="mt-3">
          <h2 className="mb-1 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Jobs presos</h2>
          <p className="text-sm text-muted-foreground">{stuckCheck.message}</p>
        </Panel>
      ) : null}

      {monitor ? (
        <Panel className="mt-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Última execução do monitor</h2>
            <StatusBadge tone={severityTone[monitor.severity]}>{severityLabel[monitor.severity]}</StatusBadge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{formatAgo(monitorAgeMs)}</p>
        </Panel>
      ) : null}

      <Panel className="mt-5">
        <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Operação</h2>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Métricas protegidas em JSON: <span className="font-mono text-foreground/80">/api/metrics</span> (owner/admin).</li>
          <li>Readiness: <span className="font-mono text-foreground/80">/api/health/ready</span> · Versão: <span className="font-mono text-foreground/80">/api/version</span>.</li>
          <li>Worker de fila: processa jobs com backoff, timeout e dead-letter; heartbeat monitorado a cada 5 min.</li>
          {canManage ? <li>Monitor operacional: script systemd a cada 5 min, cria notificação apenas em mudança de estado.</li> : null}
        </ul>
      </Panel>
    </div>
  )
}
