import { beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { z } from "zod"

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

import { KnownFormError, initialFormState, runFormAction } from "@/lib/admin/form-state"
import { AuthGuardError, requirePermission } from "@/lib/auth/session"
import { revalidatePath } from "next/cache"

const requirePermissionMock = requirePermission as unknown as Mock
const revalidatePathMock = revalidatePath as unknown as Mock

function fd(entries: Record<string, string> = {}) {
  const data = new FormData()
  for (const [key, value] of Object.entries(entries)) data.append(key, value)
  return data
}

describe("initialFormState", () => {
  it("starts with submissionId 0 and success false", () => {
    expect(initialFormState()).toEqual({ success: false, submissionId: 0 })
  })
})

describe("runFormAction", () => {
  beforeEach(() => {
    requirePermissionMock.mockReset()
    revalidatePathMock.mockClear()
  })

  it("returns success with data and increments submissionId", async () => {
    requirePermissionMock.mockResolvedValue({ id: "user-1", role: "owner" })
    const operation = vi.fn(async (actorId: string) => ({ actorId }))

    const result = await runFormAction("customers", "create", ["/", "/clientes"], initialFormState(), operation, fd())

    expect(result).toEqual({ success: true, data: { actorId: "user-1" }, submissionId: 1 })
    expect(revalidatePathMock).toHaveBeenCalledTimes(2)
  })

  it("increments submissionId on every call, even repeated failures", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })
    const failing = async () => {
      throw new KnownFormError("Falhou de propósito.")
    }
    const first = await runFormAction("customers", "create", ["/"], initialFormState(), failing, fd())
    const second = await runFormAction("customers", "create", ["/"], first, failing, fd())
    expect(first.submissionId).toBe(1)
    expect(second.submissionId).toBe(2)
  })

  it("maps a denied permission to a safe, generic message", async () => {
    requirePermissionMock.mockRejectedValue(new AuthGuardError(403, "denied"))
    const result = await runFormAction("orders", "update", ["/"], initialFormState(), vi.fn(), fd())
    expect(result).toMatchObject({ success: false, error: "Você não tem permissão para esta ação." })
  })

  it("maps an expired session to a safe, generic message", async () => {
    requirePermissionMock.mockRejectedValue(new AuthGuardError(401, "no session"))
    const result = await runFormAction("orders", "update", ["/"], initialFormState(), vi.fn(), fd())
    expect(result).toMatchObject({ success: false, error: "Sessão expirada. Faça login novamente." })
  })

  it("maps Zod validation errors to per-field errors without leaking internals", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })
    const operation = async () => {
      z.object({ email: z.string().email() }).parse({ email: "not-an-email" })
      return null
    }
    const result = await runFormAction("customers", "create", ["/"], initialFormState(), operation, fd())
    expect(result.success).toBe(false)
    expect(result.fieldErrors?.email).toBeDefined()
    expect(result.error).toBe("Verifique os campos destacados.")
    expect(JSON.stringify(result)).not.toMatch(/\bat\s+\w+.*:\d+:\d+/)
  })

  it("surfaces a KnownFormError message verbatim (intentional, user-facing)", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })
    const operation = async () => {
      throw new KnownFormError("E-mail já cadastrado.")
    }
    const result = await runFormAction("customers", "create", ["/"], initialFormState(), operation, fd())
    expect(result).toMatchObject({ success: false, error: "E-mail já cadastrado." })
  })

  it("replaces an unexpected error (e.g. a raw driver/DB error) with a generic message", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })
    const operation = async () => {
      throw new Error('duplicate key value violates unique constraint "customers_email_key"')
    }
    const result = await runFormAction("customers", "create", ["/"], initialFormState(), operation, fd())
    expect(result.success).toBe(false)
    expect(result.error).toBe("Não foi possível concluir a ação. Tente novamente.")
    expect(result.error).not.toContain("constraint")
    expect(result.error).not.toContain("customers_email_key")
  })

  it("never leaks a stack trace in the serialized result for any failure path", async () => {
    requirePermissionMock.mockResolvedValue({ id: "u", role: "owner" })
    const operation = async () => {
      throw new Error("boom")
    }
    const result = await runFormAction("customers", "create", ["/"], initialFormState(), operation, fd())
    expect(JSON.stringify(result)).not.toMatch(/\bat\s+\w+.*:\d+:\d+/)
  })
})
