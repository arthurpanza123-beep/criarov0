import Link from "next/link"
import { Check, CheckCheck } from "lucide-react"

import { markAllNotificationsReadAction, markNotificationReadAction } from "./actions"
import { DataTable, EmptyState, PageHeader, Pagination, StatusBadge, TableShell } from "@/components/admin/primitives"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/admin/display"
import { readSearchParams, type PageSearchParams } from "@/lib/admin/search-params"
import { requirePermission } from "@/lib/auth/session"
import { cn } from "@/lib/utils"
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/types"
import { notificationsService } from "@/lib/services/notifications-service"

export const dynamic = "force-dynamic"

const toneByType: Record<NotificationType, "default" | "good" | "warn" | "bad"> = {
  info: "default",
  success: "good",
  warning: "warn",
  error: "bad",
}

const filters = [
  { value: "", label: "Todas" },
  { value: "true", label: "Não lidas" },
  { value: "false", label: "Lidas" },
]

const basePath = "/notificacoes"

export default async function NotificationsPage({ searchParams }: { searchParams?: PageSearchParams }) {
  await requirePermission("dashboard", "read")
  const params = await readSearchParams(searchParams)
  const result = await notificationsService.list(params)
  const activeFilter = params.unread ?? ""

  return (
    <div>
      <PageHeader
        title="Notificações"
        description="Alertas internos do sistema. A marcação de leitura exige sessão autenticada e é validada no servidor."
      >
        <form action={markAllNotificationsReadAction}>
          <Button type="submit" variant="outline" size="sm">
            <CheckCheck className="size-4" />
            Marcar todas como lidas
          </Button>
        </form>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Link
            key={filter.value || "all"}
            href={filter.value ? `${basePath}?unread=${filter.value}` : basePath}
            className={cn(
              "inline-flex h-8 items-center rounded-lg border border-border bg-background/60 px-3 text-xs text-muted-foreground transition hover:text-foreground",
              activeFilter === filter.value && "border-primary/40 bg-primary/10 text-primary",
            )}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {result.data.length === 0 ? (
        <EmptyState>Nenhuma notificação encontrada.</EmptyState>
      ) : (
        <>
          <TableShell>
            <DataTable headers={["Status", "Tipo", "Título", "Mensagem", "Data", "Ações"]}>
              {result.data.map((notification) => (
                <tr key={notification.id} className="align-top">
                  <td className="px-3 py-3">
                    <StatusBadge tone={notification.readAt ? "default" : "good"}>
                      {notification.readAt ? "lida" : "não lida"}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone={toneByType[notification.type as NotificationType] ?? "default"}>
                      {notification.type}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-3 font-medium">{notification.title}</td>
                  <td className="max-w-[360px] px-3 py-3 text-muted-foreground">{notification.message}</td>
                  <td className="px-3 py-3">{formatDate(notification.createdAt)}</td>
                  <td className="px-3 py-3">
                    {notification.readAt ? (
                      <span className="text-xs text-muted-foreground">-</span>
                    ) : (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="id" value={notification.id} />
                        <Button type="submit" size="icon-sm" variant="outline" aria-label="Marcar como lida">
                          <Check className="size-3.5" />
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
          </TableShell>
          <Pagination page={result.page} totalPages={result.totalPages} basePath={basePath} />
        </>
      )}

      <p className="mt-3 font-mono text-[10px] text-muted-foreground">{NOTIFICATION_TYPES.length} tipos suportados: {NOTIFICATION_TYPES.join(", ")}</p>
    </div>
  )
}
