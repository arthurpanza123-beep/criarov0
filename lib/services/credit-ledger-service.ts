import { z } from "zod"

import type { CreditLedgerRow } from "@/lib/db/schema"

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

export const creditLedgerService = {
  calculateConfirmedLedgerBalance,
}
