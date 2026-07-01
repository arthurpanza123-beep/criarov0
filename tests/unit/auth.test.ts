import { describe, expect, it } from "vitest"

import { can, isRole } from "@/lib/auth/permissions"
import { assertCanBlockUser, assertCanChangeUserRole, shouldForcePasswordChange } from "@/lib/auth/policy"
import { sanitizeCallbackUrl } from "@/lib/auth/redirects"
import { validateStrongPassword } from "@/lib/auth/password"

describe("auth permissions", () => {
  it("allows owner full access", () => {
    expect(can("owner", "users", "manage")).toBe(true)
    expect(can("owner", "settings", "manage")).toBe(true)
    expect(can("owner", "creditLedger", "archive")).toBe(true)
  })

  it("keeps admin away from critical security settings", () => {
    expect(can("admin", "campaigns", "manage")).toBe(true)
    expect(can("admin", "creditLedger", "create")).toBe(true)
    expect(can("admin", "users", "manage")).toBe(false)
    expect(can("admin", "settings", "manage")).toBe(false)
  })

  it("keeps operator away from administrative and financial mutations", () => {
    expect(can("operator", "referrals", "create")).toBe(true)
    expect(can("operator", "orders", "update")).toBe(true)
    expect(can("operator", "users", "manage")).toBe(false)
    expect(can("operator", "creditLedger", "create")).toBe(false)
  })

  it("makes viewer read only", () => {
    expect(can("viewer", "dashboard", "read")).toBe(true)
    expect(can("viewer", "orders", "update")).toBe(false)
    expect(can("viewer", "users", "create")).toBe(false)
  })
})

describe("auth validation", () => {
  it("validates roles", () => {
    expect(isRole("owner")).toBe(true)
    expect(isRole("superadmin")).toBe(false)
  })

  it("requires strong passwords", () => {
    expect(validateStrongPassword("weak").ok).toBe(false)
    expect(validateStrongPassword("StrongTemporary!42").ok).toBe(true)
  })

  it("accepts only safe relative callback urls", () => {
    expect(sanitizeCallbackUrl("/usuarios?x=1")).toBe("/usuarios?x=1")
    expect(sanitizeCallbackUrl("https://evil.example")).toBe("/")
    expect(sanitizeCallbackUrl("//evil.example/path")).toBe("/")
    expect(sanitizeCallbackUrl("/api/auth/sign-out")).toBe("/")
  })
})

describe("user safety policy", () => {
  it("blocks removing the last active owner", () => {
    expect(() =>
      assertCanChangeUserRole({
        actorRole: "owner",
        targetRole: "owner",
        nextRole: "admin",
        remainingActiveOwners: 0,
      }),
    ).toThrow("último owner")
  })

  it("blocks owner self deactivation", () => {
    expect(() =>
      assertCanBlockUser({
        actorId: "user-1",
        actorRole: "owner",
        targetId: "user-1",
        targetRole: "owner",
        remainingActiveOwners: 1,
      }),
    ).toThrow("si mesmo")
  })

  it("preserves mustChangePassword semantics", () => {
    expect(shouldForcePasswordChange(true)).toBe(true)
    expect(shouldForcePasswordChange(false)).toBe(false)
  })
})
