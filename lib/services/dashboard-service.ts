import "server-only"

import { desc, gte, lte, sql } from "drizzle-orm"

import { centsToDecimal, decimalToCents } from "@/lib/admin/money"
import { getDb } from "@/lib/db"
import {
  activities,
  campaigns,
  creditLedger,
  customers,
  managedAccounts,
  orders,
  referrals,
} from "@/lib/db/schema"

export type DashboardRange = "today" | "7d" | "30d" | "month" | "custom"

export function resolveDashboardRange(input?: {
  range?: string
  from?: string
  to?: string
}) {
  const now = new Date()
  const start = new Date(now)
  const end = now

  switch (input?.range) {
    case "today":
      start.setHours(0, 0, 0, 0)
      break
    case "7d":
      start.setDate(start.getDate() - 7)
      break
    case "month":
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case "custom": {
      const customFrom = input.from ? new Date(input.from) : start
      const customTo = input.to ? new Date(input.to) : end
      return {
        range: "custom" as DashboardRange,
        from: Number.isFinite(customFrom.getTime()) ? customFrom : start,
        to: Number.isFinite(customTo.getTime()) ? customTo : end,
      }
    }
    case "30d":
    default:
      start.setDate(start.getDate() - 30)
      break
  }

  return {
    range: (input?.range === "today" || input?.range === "7d" || input?.range === "month" ? input.range : "30d") as DashboardRange,
    from: start,
    to: end,
  }
}

export async function getDashboardMetrics(input?: { range?: string; from?: string; to?: string }) {
  const db = getDb()
  const range = resolveDashboardRange(input)

  const [
    accountRows,
    campaignRows,
    referralRows,
    customerRows,
    orderRows,
    ledgerRows,
    recentActivities,
  ] = await Promise.all([
    db
      .select({
        active: sql<number>`count(*) filter (where ${managedAccounts.status} = 'active' and ${managedAccounts.archivedAt} is null)::int`,
        inactive: sql<number>`count(*) filter (where ${managedAccounts.status} in ('inactive', 'suspended') and ${managedAccounts.archivedAt} is null)::int`,
        archived: sql<number>`count(*) filter (where ${managedAccounts.archivedAt} is not null or ${managedAccounts.status} = 'archived')::int`,
        monthlyLimit: sql<string>`coalesce(sum(${managedAccounts.monthlyCreditLimit}), 0)::text`,
      })
      .from(managedAccounts),
    db
      .select({
        active: sql<number>`count(*) filter (where ${campaigns.active} = true and ${campaigns.archivedAt} is null)::int`,
      })
      .from(campaigns),
    db
      .select({
        pending: sql<number>`count(*) filter (where ${referrals.status} in ('pending', 'invited', 'accessed', 'registered', 'awaiting_approval') and ${referrals.archivedAt} is null)::int`,
        approved: sql<number>`count(*) filter (where ${referrals.status} = 'approved')::int`,
        approvedRewards: sql<string>`coalesce(sum(${referrals.approvedReward}) filter (where ${referrals.status} = 'approved'), 0)::text`,
      })
      .from(referrals),
    db
      .select({
        active: sql<number>`count(*) filter (where ${customers.archivedAt} is null)::int`,
      })
      .from(customers),
    db
      .select({
        pending: sql<number>`count(*) filter (where ${orders.status} in ('draft', 'pending_payment', 'paid', 'processing') and ${orders.archivedAt} is null)::int`,
        delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
        revenue: sql<string>`coalesce(sum(${orders.salePrice}) filter (where ${orders.status} in ('paid', 'processing', 'delivered')), 0)::text`,
        cost: sql<string>`coalesce(sum(${orders.costPrice}) filter (where ${orders.status} in ('paid', 'processing', 'delivered')), 0)::text`,
      })
      .from(orders),
    db
      .select({
        confirmedBalance: sql<string>`coalesce(sum(case when ${creditLedger.type} in ('earned', 'sale', 'adjustment') then ${creditLedger.amount} when ${creditLedger.type} in ('spent', 'expired') then -${creditLedger.amount} else 0 end) filter (where ${creditLedger.status} = 'confirmed'), 0)::text`,
        spentInPeriod: sql<string>`coalesce(sum(${creditLedger.amount}) filter (where ${creditLedger.status} = 'confirmed' and ${creditLedger.type} in ('spent', 'expired') and ${gte(creditLedger.occurredAt, range.from)} and ${lte(creditLedger.occurredAt, range.to)}), 0)::text`,
      })
      .from(creditLedger),
    db
      .select({
        id: activities.id,
        action: activities.action,
        entityType: activities.entityType,
        entityId: activities.entityId,
        createdAt: activities.createdAt,
      })
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(8),
  ])

  const accounts = accountRows[0] ?? { active: 0, inactive: 0, archived: 0, monthlyLimit: "0" }
  const campaign = campaignRows[0] ?? { active: 0 }
  const referral = referralRows[0] ?? { pending: 0, approved: 0, approvedRewards: "0" }
  const customer = customerRows[0] ?? { active: 0 }
  const order = orderRows[0] ?? { pending: 0, delivered: 0, revenue: "0", cost: "0" }
  const ledger = ledgerRows[0] ?? { confirmedBalance: "0", spentInPeriod: "0" }

  return {
    range,
    accounts: {
      active: accounts.active,
      inactive: accounts.inactive,
      archived: accounts.archived,
      monthlyLimit: accounts.monthlyLimit,
    },
    ledger: {
      confirmedBalance: ledger.confirmedBalance,
      spentInPeriod: ledger.spentInPeriod,
    },
    campaigns: {
      active: campaign.active,
    },
    referrals: {
      pending: referral.pending,
      approved: referral.approved,
      approvedRewards: referral.approvedRewards,
    },
    customers: {
      active: customer.active,
    },
    orders: {
      pending: order.pending,
      delivered: order.delivered,
      revenue: order.revenue,
      cost: order.cost,
      grossProfit: centsToDecimal(decimalToCents(order.revenue) - decimalToCents(order.cost)),
    },
    recentActivities,
  }
}

export const dashboardService = {
  getMetrics: getDashboardMetrics,
}
