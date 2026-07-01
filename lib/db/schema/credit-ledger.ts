import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { campaigns } from "./campaigns"
import { creditLedgerStatusEnum, creditLedgerTypeEnum } from "./enums"
import { managedAccounts } from "./managed-accounts"
import { referrals } from "./referrals"
import { createdAt, id, money } from "./shared"

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    managedAccountId: uuid("managed_account_id")
      .notNull()
      .references(() => managedAccounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    referralId: uuid("referral_id").references(() => referrals.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    type: creditLedgerTypeEnum("type").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: creditLedgerStatusEnum("status").notNull().default("pending"),
    description: text("description"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (table) => [
    check("credit_ledger_currency_length_chk", sql`char_length(${table.currency}) between 3 and 8`),
    index("credit_ledger_managed_account_id_idx").on(table.managedAccountId),
    index("credit_ledger_occurred_at_idx").on(table.occurredAt),
    index("credit_ledger_type_status_idx").on(table.type, table.status),
  ],
)

export type CreditLedgerRow = typeof creditLedger.$inferSelect
export type NewCreditLedgerRow = typeof creditLedger.$inferInsert
