import { pgEnum } from "drizzle-orm/pg-core"

export const managedAccountStatusEnum = pgEnum("managed_account_status", [
  "active",
  "inactive",
  "suspended",
  "archived",
])

export const referralStatusEnum = pgEnum("referral_status", [
  "pending",
  "invited",
  "accessed",
  "registered",
  "awaiting_approval",
  "approved",
  "rejected",
  "archived",
])

export const creditLedgerTypeEnum = pgEnum("credit_ledger_type", [
  "earned",
  "spent",
  "adjustment",
  "expired",
  "sale",
])

export const creditLedgerStatusEnum = pgEnum("credit_ledger_status", [
  "pending",
  "confirmed",
  "cancelled",
])

export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "pending_payment",
  "paid",
  "processing",
  "delivered",
  "cancelled",
  "refunded",
])

export const notificationTypeEnum = pgEnum("notification_type", [
  "info",
  "success",
  "warning",
  "error",
])
