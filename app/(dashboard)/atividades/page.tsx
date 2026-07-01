import { DataTable, EmptyState, PageHeader, Pagination, SearchFilter, TableShell } from "@/components/admin/primitives"
import { can } from "@/lib/auth/permissions"
import { requirePermission } from "@/lib/auth/session"
import { sanitizeActivityMetadata } from "@/lib/admin/activity-metadata"
import { formatDate, safeText } from "@/lib/admin/display"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { activitiesService } from "@/lib/services/activity-log-service"

export const dynamic = "force-dynamic"

function safeMetadata(metadata: Record<string, unknown> | null | undefined, detailed: boolean) {
  if (!detailed) return "-"
  const safe = sanitizeActivityMetadata(metadata)
  if (Object.keys(safe).length === 0) return "-"
  return JSON.stringify(safe)
}

export default async function ActivitiesPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const actor = await requirePermission("activities", "read")
  const params = await readSearchParams(searchParams)
  const result = await activitiesService.list(params)
  const detailed = can(actor.role, "activities", "manage") || actor.role === "admin"

  return (
    <div>
      <PageHeader title="Atividades" description="Auditoria administrativa sem senhas, tokens, cookies ou headers sensíveis." />
      <SearchFilter placeholder="Buscar por ação, entidade ou ator" />
      {result.data.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Data", "Ator", "Ação", "Entidade", "Registro", "Metadata"]}>
              {result.data.map((activity) => (
                <tr key={activity.id} className="align-top">
                  <td className="px-3 py-3">{formatDate(activity.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div>{safeText(activity.actorName)}</div>
                    <div className="text-xs text-muted-foreground">{safeText(activity.actorEmail)}</div>
                  </td>
                  <td className="px-3 py-3">{activity.action}</td>
                  <td className="px-3 py-3">{activity.entityType}</td>
                  <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{activity.entityId}</td>
                  <td className="max-w-[320px] truncate px-3 py-3 font-mono text-xs text-muted-foreground">
                    {safeMetadata(activity.metadata, detailed)}
                  </td>
                </tr>
              ))}
            </DataTable>
          </TableShell>
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/atividades" />
        </>
      )}
    </div>
  )
}
