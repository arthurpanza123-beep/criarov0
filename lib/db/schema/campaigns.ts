import { sql } from "drizzle-orm"
import { boolean, check, index, integer, pgTable, text } from "drizzle-orm/pg-core"

import { archivedAt, createdAt, id, money, updatedAt } from "./shared"

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    name: text("name").notNull(),
    platform: text("platform").notNull(),
    referralUrl: text("referral_url"),
    rewardPerConversion: money("reward_per_conversion").notNull().default("0"),
    monthlyLimit: integer("monthly_limit"),
    currency: text("currency").notNull().default("USD"),
    active: boolean("active").notNull().default(true),
    termsUrl: text("terms_url"),
    notes: text("notes"),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("campaigns_reward_non_negative_chk", sql`${table.rewardPerConversion} >= 0`),
    check("campaigns_monthly_limit_non_negative_chk", sql`${table.monthlyLimit} is null or ${table.monthlyLimit} >= 0`),
    check("campaigns_currency_length_chk", sql`char_length(${table.currency}) between 3 and 8`),
    index("campaigns_platform_idx").on(table.platform),
    index("campaigns_active_idx").on(table.active),
  ],
)

export type CampaignRow = typeof campaigns.$inferSelect
export type NewCampaignRow = typeof campaigns.$inferInsert
