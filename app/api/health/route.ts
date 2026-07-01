import packageJson from "@/package.json"

export const dynamic = "force-dynamic"

type HealthResponse = {
  status: "ok"
  service: "v0-farm-console"
  timestamp: string
  version: string
}

export function GET() {
  const body: HealthResponse = {
    status: "ok",
    service: "v0-farm-console",
    timestamp: new Date().toISOString(),
    version: packageJson.version,
  }

  return Response.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}
