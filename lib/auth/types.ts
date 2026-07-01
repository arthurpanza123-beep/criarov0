export const roles = ["owner", "admin", "operator", "viewer"] as const

export type Role = (typeof roles)[number]

export const resources = [
  "dashboard",
  "managedAccounts",
  "campaigns",
  "referrals",
  "customers",
  "orders",
  "creditLedger",
  "activities",
  "settings",
  "users",
] as const

export const actions = ["read", "create", "update", "archive", "manage"] as const

export type Resource = (typeof resources)[number]
export type Action = (typeof actions)[number]

export type Permission = {
  resource: Resource
  action: Action
}

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  banned: boolean | null
  banReason?: string | null
  banExpires?: Date | null
  mustChangePassword: boolean
  createdAt: Date
  updatedAt: Date
}

export type AuthSession = {
  id: string
  userId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
