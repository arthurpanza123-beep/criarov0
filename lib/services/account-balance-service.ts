import { and, eq } from "drizzle-orm"

import type { getDb } from "@/lib/db"
import { creditLedger } from "@/lib/db/schema"
import { calculateConfirmedLedgerBalance } from "@/lib/services/credit-ledger-service"

type Db = ReturnType<typeof getDb>

export async function calculateManagedAccountBalance(managedAccountId: string, db: Db) {
  const entries = await db
    .select({
      amount: creditLedger.amount,
      status: creditLedger.status,
      type: creditLedger.type,
    })
    .from(creditLedger)
    .where(and(eq(creditLedger.managedAccountId, managedAccountId), eq(creditLedger.status, "confirmed")))

  return calculateConfirmedLedgerBalance(entries)
}

export const accountBalanceService = {
  calculateManagedAccountBalance,
}
