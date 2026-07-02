import "server-only"

import { sql } from "drizzle-orm"

import { centsToDecimal, decimalToCents } from "@/lib/admin/money"
import { getDb } from "@/lib/db"
import { creditLedger, managedAccounts, orders } from "@/lib/db/schema"

type Db = ReturnType<typeof getDb>

export type SimulatorData = {
  activeAccounts: number
  totalMonthlyLimitCents: bigint
  confirmedBalanceCents: bigint
  spentCents: bigint
  revenueCents: bigint
  costCents: bigint
  deliveredOrders: number
}

export type SimulatorInputs = {
  failureRate?: number
  periodMonths?: number
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min
  return Math.min(Math.max(value, min), max)
}

/** Ratio as a fraction (0..1) using integer inputs; safe when denominator is 0. */
function ratio(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return 0
  return Number(numerator) / Number(denominator)
}

/** Applies a 0..1 rate to a cents amount using integer math (no float on money). */
function applyRate(cents: bigint, rate: number): bigint {
  const scaled = BigInt(Math.round(clamp(rate, 0, 1) * 10_000))
  return (cents * scaled) / 10_000n
}

/**
 * Pure financial model. All money is integer cents (BigInt); ratios are plain
 * numbers. Deterministic and unit-testable with injected data.
 */
export function simulate(data: SimulatorData, inputs: SimulatorInputs = {}) {
  const failureRate = clamp(inputs.failureRate ?? 0, 0, 1)
  const periodMonths = Math.max(1, Math.floor(inputs.periodMonths ?? 1))

  const usedCents = data.spentCents
  const availableCapacityCents = data.totalMonthlyLimitCents > usedCents ? data.totalMonthlyLimitCents - usedCents : 0n
  const grossProfitCents = data.revenueCents - data.costCents
  const utilization = ratio(usedCents, data.totalMonthlyLimitCents)
  const marginPct = ratio(grossProfitCents, data.revenueCents)

  const effectiveRevenueCents = applyRate(data.revenueCents, 1 - failureRate)
  const scenarioProfitCents = effectiveRevenueCents - data.costCents
  const scenarioMarginPct = ratio(scenarioProfitCents, effectiveRevenueCents)

  const months = BigInt(periodMonths)
  const projectedRevenueCents = effectiveRevenueCents * months
  const projectedProfitCents = scenarioProfitCents * months

  return {
    inputs: { failureRate, periodMonths },
    accounts: { active: data.activeAccounts },
    capacity: {
      totalMonthlyLimit: centsToDecimal(data.totalMonthlyLimitCents),
      used: centsToDecimal(usedCents),
      available: centsToDecimal(availableCapacityCents),
      utilization,
    },
    balance: {
      confirmed: centsToDecimal(data.confirmedBalanceCents),
      spent: centsToDecimal(data.spentCents),
    },
    finance: {
      revenue: centsToDecimal(data.revenueCents),
      cost: centsToDecimal(data.costCents),
      grossProfit: centsToDecimal(grossProfitCents),
      margin: marginPct,
      deliveredOrders: data.deliveredOrders,
    },
    scenario: {
      failureRate,
      effectiveRevenue: centsToDecimal(effectiveRevenueCents),
      profit: centsToDecimal(scenarioProfitCents),
      margin: scenarioMarginPct,
    },
    projection: {
      periodMonths,
      revenue: centsToDecimal(projectedRevenueCents),
      profit: centsToDecimal(projectedProfitCents),
    },
  }
}

export async function loadSimulatorData(db: Db = getDb()): Promise<SimulatorData> {
  const [accountRow] = await db
    .select({
      active: sql<number>`count(*) filter (where ${managedAccounts.status} = 'active' and ${managedAccounts.archivedAt} is null)::int`,
      totalLimit: sql<string>`coalesce(sum(${managedAccounts.monthlyCreditLimit}) filter (where ${managedAccounts.archivedAt} is null), 0)::text`,
    })
    .from(managedAccounts)

  const [ledgerRow] = await db
    .select({
      confirmedBalance: sql<string>`coalesce(sum(case when ${creditLedger.type} in ('earned', 'sale', 'adjustment') then ${creditLedger.amount} when ${creditLedger.type} in ('spent', 'expired') then -${creditLedger.amount} else 0 end) filter (where ${creditLedger.status} = 'confirmed'), 0)::text`,
      spent: sql<string>`coalesce(sum(${creditLedger.amount}) filter (where ${creditLedger.status} = 'confirmed' and ${creditLedger.type} in ('spent', 'expired')), 0)::text`,
    })
    .from(creditLedger)

  const [orderRow] = await db
    .select({
      revenue: sql<string>`coalesce(sum(${orders.salePrice}) filter (where ${orders.status} in ('paid', 'processing', 'delivered')), 0)::text`,
      cost: sql<string>`coalesce(sum(${orders.costPrice}) filter (where ${orders.status} in ('paid', 'processing', 'delivered')), 0)::text`,
      delivered: sql<number>`count(*) filter (where ${orders.status} = 'delivered')::int`,
    })
    .from(orders)

  return {
    activeAccounts: accountRow?.active ?? 0,
    totalMonthlyLimitCents: decimalToCents(accountRow?.totalLimit ?? "0"),
    confirmedBalanceCents: decimalToCents(ledgerRow?.confirmedBalance ?? "0"),
    spentCents: decimalToCents(ledgerRow?.spent ?? "0"),
    revenueCents: decimalToCents(orderRow?.revenue ?? "0"),
    costCents: decimalToCents(orderRow?.cost ?? "0"),
    deliveredOrders: orderRow?.delivered ?? 0,
  }
}

export async function getSimulatorReport(inputs: SimulatorInputs = {}, db: Db = getDb()) {
  const data = await loadSimulatorData(db)
  return simulate(data, inputs)
}

export const simulatorService = {
  simulate,
  loadData: loadSimulatorData,
  report: getSimulatorReport,
}
