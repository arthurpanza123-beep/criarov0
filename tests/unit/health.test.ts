import { describe, expect, it } from "vitest"

import { GET } from "../../app/api/health/route"
import packageJson from "../../package.json"

describe("GET /api/health", () => {
  it("returns a non-cacheable health payload without sensitive details", async () => {
    const response = GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(body).toEqual({
      status: "ok",
      service: "v0-farm-console",
      timestamp: expect.any(String),
      version: packageJson.version,
    })
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp)
    expect(Object.keys(body).sort()).toEqual([
      "service",
      "status",
      "timestamp",
      "version",
    ])
  })
})
