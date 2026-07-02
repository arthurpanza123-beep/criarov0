import { AuthGuardError, requirePermission } from "@/lib/auth/session"
import { versionInfo } from "@/lib/observability/version"
import { queueHealth } from "@/lib/services/jobs-service"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requirePermission("system", "read")
    const queue = await queueHealth()
    return Response.json(
      { version: versionInfo(), queue, timestamp: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store, private" } },
    )
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return Response.json(
        { error: error.status === 401 ? "Não autenticado." : "Acesso negado." },
        { status: error.status, headers: { "Cache-Control": "no-store, private" } },
      )
    }
    return Response.json({ error: "Erro interno." }, { status: 500, headers: { "Cache-Control": "no-store, private" } })
  }
}
