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


export const jobTypeEnum = pgEnum("job_type", [
  "reconcile_account",
  "generate_notification",
  "import_entities",
  "export_report",
  "maintenance",
])

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "scheduled",
  "running",
  "completed",
  "failed",
  "dead_letter",
  "cancelled",
])

export const jobRunStatusEnum = pgEnum("job_run_status", [
  "running",
  "completed",
  "failed",
  "timeout",
  "cancelled",
])

export const importEntityEnum = pgEnum("import_entity", [
  "managed_accounts",
  "campaigns",
  "customers",
])

export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "validated",
  "dry_run",
  "imported",
  "failed",
  "cancelled",
])
