import { createAccessControl } from "better-auth/plugins/access"

import { actions, resources, roles, type Action, type Permission, type Resource, type Role } from "@/lib/auth/types"

export const accessControl = createAccessControl({
  user: ["create", "list", "get", "update", "delete", "ban", "set-role", "set-password", "set-email"],
  dashboard: actions,
  managedAccounts: actions,
  campaigns: actions,
  referrals: actions,
  customers: actions,
  orders: actions,
  creditLedger: actions,
  activities: actions,
  settings: actions,
  users: actions,
} as const)

const readOnly = {
  dashboard: ["read"],
  managedAccounts: ["read"],
  campaigns: ["read"],
  referrals: ["read"],
  customers: ["read"],
  orders: ["read"],
  creditLedger: ["read"],
  activities: ["read"],
  settings: ["read"],
} as const

export const rbacRoles = {
  owner: accessControl.newRole({
    dashboard: actions,
    managedAccounts: actions,
    campaigns: actions,
    referrals: actions,
    customers: actions,
    orders: actions,
    creditLedger: actions,
    activities: actions,
    settings: actions,
    users: actions,
    user: ["create", "list", "get", "update", "ban", "set-role", "set-password", "set-email"],
  }),
  admin: accessControl.newRole({
    dashboard: ["read"],
    managedAccounts: actions,
    campaigns: actions,
    referrals: actions,
    customers: actions,
    orders: actions,
    creditLedger: ["read", "create"],
    activities: ["read"],
    settings: ["read", "update"],
  }),
  operator: accessControl.newRole({
    dashboard: ["read"],
    managedAccounts: ["read", "update"],
    campaigns: ["read"],
    referrals: ["read", "create", "update"],
    customers: ["read"],
    orders: ["read", "update"],
    creditLedger: ["read"],
    activities: ["read", "create"],
  }),
  viewer: accessControl.newRole(readOnly),
} as const

export const roleValues = roles
export const resourceValues = resources
export const actionValues = actions

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roleValues.includes(value as Role)
}

export function assertValidRole(value: unknown): asserts value is Role {
  if (!isRole(value)) {
    throw new Error("Invalid role.")
  }
}

export function can(role: Role, resource: Resource, action: Action) {
  return rbacRoles[role].authorize({ [resource]: [action] }).success
}

export function hasPermission(role: Role, permission: Permission) {
  return can(role, permission.resource, permission.action)
}

export function canManageRole(actorRole: Role, targetRole: Role) {
  if (actorRole === "owner") return true
  if (targetRole === "owner") return false
  return actorRole === "admin"
}

export function canCreateRole(actorRole: Role, targetRole: Role) {
  return canManageRole(actorRole, targetRole)
}
