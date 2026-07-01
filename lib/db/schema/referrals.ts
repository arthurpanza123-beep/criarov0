import { sql } from "drizzle-orm"
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

import { campaigns } from "./campaigns"
import { referralStatusEnum } from "./enums"
import { archivedAt, createdAt, id, money, updatedAt } from "./shared"

export const referrals = pgTable(
  "referrals",
  {
    id: id(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "restrict", onUpdate: "cascade" }),
    contactName: text("contact_name").notNull(),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    status: referralStatusEnum("status").notNull().default("pending"),
    expectedReward: money("expected_reward").notNull().default("0"),
    approvedReward: money("approved_reward"),
    invitedAt: timestamp("invited_at", { withTimezone: true }),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    archivedAt: archivedAt(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check("referrals_contact_email_lower_chk", sql`${table.contactEmail} is null or ${table.contactEmail} = lower(${table.contactEmail})`),
    check("referrals_expected_reward_non_negative_chk", sql`${table.expectedReward} >= 0`),
    check("referrals_approved_reward_non_negative_chk", sql`${table.approvedReward} is null or ${table.approvedReward} >= 0`),
    index("referrals_campaign_id_idx").on(table.campaignId),
    index("referrals_status_idx").on(table.status),
    index("referrals_created_at_idx").on(table.createdAt),
  ],
)

export type ReferralRow = typeof referrals.$inferSelect
export type NewReferralRow = typeof referrals.$inferInsert
