import { versionInfo } from "@/lib/observability/version"

export const dynamic = "force-dynamic"

export function GET() {
  return Response.json(versionInfo(), { status: 200, headers: { "Cache-Control": "no-store" } })
}
