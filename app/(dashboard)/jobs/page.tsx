import Link from "next/link"
import { Ban, PlayCircle, RotateCcw, Wrench } from "lucide-react"

import { cancelJobAction, enqueueMaintenanceAction, enqueueReconcileFormAction, enqueueReportAction, retryJobAction, runQueueNowAction } from "./actions"
import { ActionForm } from "@/components/admin/action-form"
import { DataTable, EmptyState, MetricCard, PageHeader, Pagination, Panel, StatusBadge, TableShell } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/admin/display"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { JOB_STATUSES, JOB_TYPES, jobStats, listJobs, type JobStatus } from "@/lib/services/jobs-service"
import { managedAccountsService } from "@/lib/services/managed-accounts-service"

export const dynamic = "force-dynamic"

const toneByStatus: Record<JobStatus, "default" | "good" | "warn" | "bad"> = {
  pending: "default",
  scheduled: "default",
  running: "warn",
  completed: "good",
  failed: "bad",
  dead_letter: "bad",
  cancelled: "default",
}

export default async function JobsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("jobs", "read")
  const params = await readSearchParams(searchParams)
  const [result, stats, accounts] = await Promise.all([
    listJobs(params),
    jobStats(),
    managedAccountsService.list({ pageSize: "100" }),
  ])
  const canCreate = can(actor.role, "jobs", "create")
  const canManage = can(actor.role, "jobs", "manage")

  return (
    <div>
      <PageHeader title="Fila de jobs" description="Fila operacional persistente (PostgreSQL). Estados, tentativas, backoff, dead-letter e cancelamento seguro.">
        {canManage ? (
          <form action={runQueueNowAction}>
            <Button type="submit" variant="outline" size="sm">
              <PlayCircle className="size-4" />
              Processar fila agora
            </Button>
          </form>
        ) : null}
      </PageHeader>

      <div className="mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <MetricCard label="Pendentes" value={stats.pending + stats.scheduled} />
        <MetricCard label="Executando" value={stats.running} />
        <MetricCard label="Concluídos" value={stats.completed} />
        <MetricCard label="Falhas" value={stats.failed} />
        <MetricCard label="Dead-letter" value={stats.dead_letter} />
        <MetricCard label="Cancelados" value={stats.cancelled} />
        <MetricCard label="Total" value={result.total} />
      </div>

      {canCreate ? (
        <Panel className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            <ActionForm
              action={enqueueReconcileFormAction}
              successMessage="Reconciliação enfileirada."
              className="flex items-end gap-2"
              submitLabel="Enfileirar"
              submitVariant="outline"
            >
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                Reconciliar conta
                <select name="managedAccountId" required className="h-9 min-w-56 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
                  <option value="">Selecione a conta</option>
                  {accounts.data.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.label}
                    </option>
                  ))}
                </select>
              </div>
            </ActionForm>
            <form action={enqueueMaintenanceAction}>
              <Button type="submit" variant="outline">
                <Wrench className="size-4" />
                Manutenção
              </Button>
            </form>
            <form action={enqueueReportAction}>
              <Button type="submit" variant="outline">Gerar relatório</Button>
            </form>
          </div>
        </Panel>
      ) : null}

      <form className="mb-4 flex flex-wrap gap-2">
        <select name="status" defaultValue={params.status ?? ""} className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
          <option value="">Todos os status</option>
          {JOB_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select name="type" defaultValue={params.type ?? ""} className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none">
          <option value="">Todos os tipos</option>
          {JOB_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <Button type="submit" variant="outline">Filtrar</Button>
      </form>

      {result.data.length === 0 ? (
        <EmptyState>Nenhum job na fila.</EmptyState>
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Tipo", "Status", "Tentativas", "Prioridade", "Agendado", "Criado", "Ações"]}>
              {result.data.map((job) => (
                <tr key={job.id} className="align-top">
                  <td className="px-3 py-3">
                    <Link href={`/jobs/${job.id}`} className="font-medium text-foreground hover:underline">
                      {job.type}
                    </Link>
                    <div className="font-mono text-[10px] text-muted-foreground">{job.id.slice(0, 8)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={toneByStatus[job.status]}>{job.status}</StatusBadge>
                  </td>
                  <td className="px-3 py-3">{job.attempts}/{job.maxAttempts}</td>
                  <td className="px-3 py-3">{job.priority}</td>
                  <td className="px-3 py-3">{formatDate(job.runAt)}</td>
                  <td className="px-3 py-3">{formatDate(job.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/jobs/${job.id}`} className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2 text-xs text-muted-foreground transition hover:text-foreground">
                        Detalhes
                      </Link>
                      {canManage && ["failed", "dead_letter", "cancelled", "completed"].includes(job.status) ? (
                        <form action={retryJobAction}>
                          <input type="hidden" name="id" value={job.id} />
                          <Button type="submit" size="icon-sm" variant="outline" aria-label="Reprocessar">
                            <RotateCcw className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                      {canManage && ["pending", "scheduled", "failed", "dead_letter"].includes(job.status) ? (
                        <form action={cancelJobAction}>
                          <input type="hidden" name="id" value={job.id} />
                          <Button type="submit" size="icon-sm" variant="destructive" aria-label="Cancelar">
                            <Ban className="size-3.5" />
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </DataTable>
          </TableShell>
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/jobs" />
        </>
      )}
    </div>
  )
}
