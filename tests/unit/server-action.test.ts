import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { z } from "zod"

// The real modules require a Next.js request scope / a database. We mock them so
// the guard's control flow (permission -> operation -> revalidate -> safe result)
// can be exercised in isolation. Factories are self-contained to stay hoist-safe.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/auth/session", () => {
  class AuthGuardError extends Error {
    status: 401 | 403
    constructor(status: 401 | 403, message: string) {
      super(message)
      this.status = status
    }
  }
  return { AuthGuardError, requirePermission: vi.fn() }
})

import { runGuardedAction } from "@/lib/admin/server-action"
import { AuthGuardError, requirePermission } from "@/lib/auth/session"
import { revalidatePath } from "next/cache"

const requirePermissionMock = requirePermission as unknown as Mock
const revalidatePathMock = revalidatePath as unknown as Mock

describe("runGuardedAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset()
    revalidatePathMock.mockClear()
  })

  it("runs the operation and revalidates every path on success", async () => {
    requirePermissionMock.mockResolvedValue({ id: "user-1", role: "owner" })
    const operation = vi.fn(async (actorId: string) => ({ actorId }))

    const result = await runGuardedAction("customers", "create", ["/", "/clientes"], operation)

    expect(requirePermissionMock).toHaveBeenCalledWith("customers", "create")
    expect(operation).toHaveBeenCalledWith("user-1")
    expect(result).toEqual({ success: true, data: { actorId: "user-1" } })
    expect(revalidatePathMock).toHaveBeenCalledTimes(2)
  })

  it("blocks the mutation and returns a safe error when permission is denied", async () => {
    requirePermissionMock.mockRejectedValue(new AuthGuardError(403, "denied"))
    const operation = vi.fn()

    const result = await runGuardedAction("orders", "update", ["/"], operation)

    expect(operation).not.toHaveBeenCalled()
    expect(revalidatePathMock).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: "Acesso negado." })
  })

  it("maps an expired session (401) to a safe message", async () => {
    requirePermissionMock.mockRejectedValue(new AuthGuardError(401, "no session"))
    const result = await runGuardedAction("orders", "update", ["/"], vi.fn())
    expect(result).toMatchObject({ success: false, error: "Sessão expirada." })
  })

  it("maps Zod validation errors to field errors without leaking a stack trace", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })

    const result = await runGuardedAction("customers", "create", ["/"], async () => {
      z.object({ name: z.string() }).parse({})
      return null
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("Dados inválidos.")
      expect(result.fieldErrors?.name).toBeDefined()
      // A serialized safe result must not contain stack frames.
      expect(JSON.stringify(result)).not.toMatch(/\bat\s+\w+.*:\d+:\d+/)
    }
  })

  it("surfaces a domain error message safely", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })
    const result = await runGuardedAction("orders", "update", ["/"], async () => {
      throw new Error("Pedido não encontrado.")
    })
    expect(result).toEqual({ success: false, error: "Pedido não encontrado." })
  })
})
