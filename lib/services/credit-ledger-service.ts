import "server-only"

import { and, count, desc, eq, gte, ilike, lte, or } from "drizzle-orm"
import { z } from "zod"

import { assertFiniteDecimal, assertNonNegativeDecimal, centsToDecimal, decimalToCents } from "@/lib/admin/money"
import { makePaginatedResult, normalizeListParams, type ListSearchParams } from "@/lib/admin/pagination"
import { getDb } from "@/lib/db"
import { campaigns, creditLedger, managedAccounts, type CreditLedgerRow, type NewCreditLedgerRow } from "@/lib/db/schema"

const decimalInputSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const parsed = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(parsed)) {
    ctx.addIssue({ code: "custom", message: "Invalid decimal amount" })
    return z.NEVER
  }
  return parsed
})

type LedgerBalanceEntry = Pick<CreditLedgerRow, "amount" | "status" | "type">

export function calculateConfirmedLedgerBalance(entries: LedgerBalanceEntry[]) {
  return entries.reduce((balance, entry) => {
    if (entry.status !== "confirmed") return balance

    const amount = decimalInputSchema.parse(entry.amount)

    switch (entry.type) {
      case "earned":
      case "sale":
        return balance + amount
      case "adjustment":
        return balance + amount
      case "spent":
      case "expired":
        return balance - amount
      default:
        return balance
    }
  }, 0)
}

export async function listCreditLedger(params: ListSearchParams = {}) {
  const input = normalizeListParams(params)
  const db = getDb()
  const conditions = [
    input.q
      ? or(
          ilike(creditLedger.description, `%${input.q}%`),
          ilike(managedAccounts.label, `%${input.q}%`),
          ilike(campaigns.name, `%${input.q}%`),
        )
      : undefined,
    input.type ? eq(creditLedger.type, input.type as "earned" | "spent" | "adjustment" | "expired" | "sale") : undefined,
    input.status ? eq(creditLedger.status, input.status as "pending" | "confirmed" | "cancelled") : undefined,
    input.accountId ? eq(creditLedger.managedAccountId, input.accountId) : undefined,
    input.campaignId ? eq(creditLedger.campaignId, input.campaignId) : undefined,
    input.from ? gte(creditLedger.occurredAt, input.from) : undefined,
    input.to ? lte(creditLedger.occurredAt, input.to) : undefined,
  ].filter(Boolean)
  const where = conditions.length ? and(...conditions) : undefined

  const [totalRow] = await db
    .select({ value: count() })
    .from(creditLedger)
    .leftJoin(managedAccounts, eq(managedAccounts.id, creditLedger.managedAccountId))
    .leftJoin(campaigns, eq(campaigns.id, creditLedger.campaignId))
    .where(where)
  const data = await db
    .select({
      id: creditLedger.id,
      managedAccountId: creditLedger.managedAccountId,
      managedAccountLabel: managedAccounts.label,
      campaignId: creditLedger.campaignId,
      campaignName: campaigns.name,
      referralId: creditLedger.referralId,
      type: creditLedger.type,
      amount: creditLedger.amount,
      currency: creditLedger.currency,
      status: creditLedger.status,
      description: creditLedger.description,
      occurredAt: creditLedger.occurredAt,
      createdAt: creditLedger.createdAt,
    })
    .from(creditLedger)
    .leftJoin(managedAccounts, eq(managedAccounts.id, creditLedger.managedAccountId))
    .leftJoin(campaigns, eq(campaigns.id, creditLedger.campaignId))
    .where(where)
    .orderBy(desc(creditLedger.occurredAt))
    .limit(input.pageSize)
    .offset(input.offset)

  return makePaginatedResult(data, totalRow?.value ?? 0, input)
}

export async function createCreditLedgerEntry(values: NewCreditLedgerRow) {
  if (values.type === "adjustment") {
    assertFiniteDecimal(values.amount, "Valor")
  } else {
    assertNonNegativeDecimal(values.amount, "Valor")
  }
  const [row] = await getDb().insert(creditLedger).values(values).returning()
  return row
}

export async function confirmCreditLedgerEntry(id: string) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(creditLedger).where(eq(creditLedger.id, id)).limit(1)
    if (!current) throw new Error("Lançamento não encontrado.")
    if (current.status === "confirmed") return current
    if (current.status === "cancelled") throw new Error("Lançamento cancelado não pode ser confirmado.")
    const [row] = await tx
      .update(creditLedger)
      .set({ status: "confirmed" })
      .where(eq(creditLedger.id, id))
      .returning()
    return row
  })
}

export async function cancelCreditLedgerEntry(id: string) {
  return getDb().transaction(async (tx) => {
    const [current] = await tx.select().from(creditLedger).where(eq(creditLedger.id, id)).limit(1)
    if (!current) throw new Error("Lançamento não encontrado.")
    if (current.status === "cancelled") return current
    const [row] = await tx
      .update(creditLedger)
      .set({ status: "cancelled" })
      .where(eq(creditLedger.id, id))
      .returning()
    return row
  })
}

export async function reconcileManagedAccountBalance(managedAccountId: string) {
  const db = getDb()
  const [account] = await db.select().from(managedAccounts).where(eq(managedAccounts.id, managedAccountId)).limit(1)
  if (!account) throw new Error("Conta não encontrada.")
  const entries = await db
    .select({
      amount: creditLedger.amount,
      type: creditLedger.type,
      status: creditLedger.status,
    })
    .from(creditLedger)
    .where(eq(creditLedger.managedAccountId, managedAccountId))
  const calculated = centsToDecimal(decimalToCents(calculateConfirmedLedgerBalance(entries)))
  return {
    persisted: account.creditBalance,
    calculated,
    diverged: decimalToCents(account.creditBalance) !== decimalToCents(calculated),
  }
}

export const creditLedgerService = {
  calculateConfirmedLedgerBalance,
  list: listCreditLedger,
  create: createCreditLedgerEntry,
  confirm: confirmCreditLedgerEntry,
  cancel: cancelCreditLedgerEntry,
  reconcile: reconcileManagedAccountBalance,
}
