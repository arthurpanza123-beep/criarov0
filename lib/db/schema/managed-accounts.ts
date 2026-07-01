import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp } from "drizzle-orm/pg-core"

import { managedAccountStatusEnum } from "./enums"
import { archivedAt, createdAt, id, money, updatedAt } from "./shared"

export const managedAccounts = pgTable(
  "managed_accounts",
  {
    id: id(),
    label: text("label").notNull(),
    email: text("email").notNull(),
    provider: text("provider").notNull(),
    status: managedAccountStatusEnum("status").notNull().default("active"),
    creditBalance: money("credit_balance").notNull().default("0"),
    monthlyCreditLimit: money("monthly_credit_limit").notNull().default("0"),
    notes: text("notes"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("managed_accounts_email_lower_chk", sql`${table.email} = lower(${table.email})`),
    check("managed_accounts_credit_balance_non_negative_chk", sql`${table.creditBalance} >= 0`),
    check("managed_accounts_monthly_limit_non_negative_chk", sql`${table.monthlyCreditLimit} >= 0`),
    index("managed_accounts_status_idx").on(table.status),
    index("managed_accounts_provider_idx").on(table.provider),
    index("managed_accounts_archived_at_idx").on(table.archivedAt),
  ],
)

export type ManagedAccountRow = typeof managedAccounts.$inferSelect
export type NewManagedAccountRow = typeof managedAccounts.$inferInsert
