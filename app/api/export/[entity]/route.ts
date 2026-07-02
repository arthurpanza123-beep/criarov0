import { recordAdminActivity } from "@/lib/admin/audit"
import { AuthGuardError, requirePermission } from "@/lib/auth/session"
import { exportEntityCsv, exportResource, isExportEntity } from "@/lib/services/export-service"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  try {
    if (!isExportEntity(entity)) {
      return Response.json({ error: "Entidade de exportação inválida." }, { status: 404, headers: { "Cache-Control": "no-store" } })
    }
    const actor = await requirePermission(exportResource[entity], "read")
    const csv = await exportEntityCsv(entity)
    await recordAdminActivity({
      actorUserId: actor.id,
      entityType: "export",
      entityId: actor.id,
      action: "export_generated",
      metadata: { entity },
    })
    const filename = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, private",
      },
    })
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return Response.json(
        { error: error.status === 401 ? "Não autenticado." : "Acesso negado." },
        { status: error.status, headers: { "Cache-Control": "no-store, private" } },
      )
    }
    return Response.json({ error: "Erro ao exportar." }, { status: 500, headers: { "Cache-Control": "no-store, private" } })
  }
}
