// E2E-only credentials (test database). Not real secrets. Password satisfies the
// 14+ char policy. Users are created in criarov0_test by the global setup.
export const E2E_PASSWORD = "E2EStrongPass!2026"

export const E2E_USERS = [
  { role: "owner", email: "owner@e2e.local", name: "E2E Owner" },
  { role: "admin", email: "admin@e2e.local", name: "E2E Admin" },
  { role: "operator", email: "operator@e2e.local", name: "E2E Operator" },
  { role: "viewer", email: "viewer@e2e.local", name: "E2E Viewer" },
] as const

export type E2ERole = (typeof E2E_USERS)[number]["role"]

export function emailFor(role: E2ERole): string {
  const found = E2E_USERS.find((user) => user.role === role)
  if (!found) throw new Error(`Unknown e2e role: ${role}`)
  return found.email
}
