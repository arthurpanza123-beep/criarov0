import type { UserRole } from "@/lib/types"

export const AUTH_ROLES: readonly UserRole[] = [
  "owner",
  "admin",
  "operator",
  "viewer",
]
