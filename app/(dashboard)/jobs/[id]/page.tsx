import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Ban, RotateCcw } from "lucide-react"

import { cancelJobAction, retryJobAction } from "../actions"
import { DataTable, EmptyState, PageHeader, Panel, StatusBadge, TableShell } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/admin/display"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { sanitizeLogValue } from "@/lib/observability/logger"
import { getJob, listJobRuns } from "@/lib/services/jobs-service"

export const dynamic = "force-dynamic"

function preview(value: unknown, max = 1500) {
  if (value === null || value === undefined) return "-"
  const text = JSON.stringify(sanitizeLogValue(value), null, 2)
  if (!text || text === "{}") return "-"
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePermission("jobs", "read")
  const { id } = await params
  const job = await getJob(id)
  if (!job) notFound()
  const runs = await listJobRuns(id)
  const canManage = can(actor.role, "jobs", "manage")

  return (
    <div>
      <PageHeader title={`Job ${job.type}`} description={`ID ${job.id}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/jobs" className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-2.5 text-xs text-muted-foreground transition hover:text-foreground">
            <ArrowLeft className="size-3.5" />
            Voltar
          </Link>
          {canManage && ["failed", "dead_letter", "cancelled", "completed"].includes(job.status) ? (
            <form action={retryJobAction}>
              <input type="hidden" name="id" value={job.id} />
              <Button type="submit" variant="outline" size="sm">
                <RotateCcw className="size-4" />
                Reprocessar
              </Button>
            </form>
          ) : null}
          {canManage && ["pending", "scheduled", "failed", "dead_letter"].includes(job.status) ? (
            <form action={cancelJobAction}>
              <input type="hidden" name="id" value={job.id} />
              <Button type="submit" variant="destructive" size="sm">
                <Ban className="size-4" />
                Cancelar
              </Button>
            </form>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
          <div className="mt-2"><StatusBadge tone={job.status === "completed" ? "good" : job.status === "failed" || job.status === "dead_letter" ? "bad" : job.status === "running" ? "warn" : "default"}>{job.status}</StatusBadge></div>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Tentativas</p>
          <p className="mt-2 text-2xl font-semibold">{job.attempts}/{job.maxAttempts}</p>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prioridade</p>
          <p className="mt-2 text-2xl font-semibold">{job.priority}</p>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Timeout</p>
          <p className="mt-2 text-2xl font-semibold">{job.timeoutMs} ms</p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Panel>
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Cronologia</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Agendado</dt><dd>{formatDate(job.runAt)}</dd>
            <dt className="text-muted-foreground">Criado</dt><dd>{formatDate(job.createdAt)}</dd>
            <dt className="text-muted-foreground">Iniciado</dt><dd>{formatDate(job.startedAt)}</dd>
            <dt className="text-muted-foreground">Finalizado</dt><dd>{formatDate(job.finishedAt)}</dd>
          </dl>
        </Panel>
        <Panel>
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Erro (sanitizado)</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{job.error ?? "-"}</p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Panel>
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Payload (sanitizado)</h2>
          <pre className="max-h-64 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-xs text-muted-foreground">{preview(job.payload)}</pre>
        </Panel>
        <Panel>
          <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Resultado (sanitizado)</h2>
          <pre className="max-h-64 overflow-auto rounded-lg bg-background/60 p-3 font-mono text-xs text-muted-foreground">{preview(job.result)}</pre>
        </Panel>
      </div>

      <h2 className="mb-2 mt-5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">Histórico de execuções</h2>
      {runs.length === 0 ? (
        <EmptyState>Nenhuma execução registrada ainda.</EmptyState>
      ) : (
        <TableShell>
          <DataTable headers={["Tentativa", "Status", "Duração", "Início", "Erro"]}>
            {runs.map((run) => (
              <tr key={run.id} className="align-top">
                <td className="px-3 py-3">{run.attempt}</td>
                <td className="px-3 py-3">
                  <StatusBadge tone={run.status === "completed" ? "good" : run.status === "failed" || run.status === "timeout" ? "bad" : "default"}>{run.status}</StatusBadge>
                </td>
                <td className="px-3 py-3">{run.durationMs != null ? `${run.durationMs} ms` : "-"}</td>
                <td className="px-3 py-3">{formatDate(run.startedAt)}</td>
                <td className="max-w-[320px] truncate px-3 py-3 text-xs text-muted-foreground">{run.error ?? "-"}</td>
              </tr>
            ))}
          </DataTable>
        </TableShell>
      )}
    </div>
  )
}
