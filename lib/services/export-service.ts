import "server-only"

import { desc } from "drizzle-orm"

import { toCsv } from "@/lib/admin/csv"
import type { Resource } from "@/lib/auth/types"
import { getDb } from "@/lib/db"
import { campaigns, creditLedger, customers, managedAccounts, orders } from "@/lib/db/schema"

type Db = ReturnType<typeof getDb>

export const EXPORT_ENTITIES = ["managed_accounts", "campaigns", "customers", "orders", "credit_ledger"] as const
export type ExportEntity = (typeof EXPORT_ENTITIES)[number]

export const EXPORT_LIMIT = 10_000

/** RBAC resource required to export each entity (export = a read of that data). */
export const exportResource: Record<ExportEntity, Resource> = {
  managed_accounts: "managedAccounts",
  campaigns: "campaigns",
  customers: "customers",
  orders: "orders",
  credit_ledger: "creditLedger",
}

export function isExportEntity(value: string): value is ExportEntity {
  return (EXPORT_ENTITIES as readonly string[]).includes(value)
}

const iso = (value: Date | string | null | undefined) => (value ? new Date(value).toISOString() : "")

export async function exportEntityCsv(entity: ExportEntity, db: Db = getDb()): Promise<string> {
  switch (entity) {
    case "managed_accounts": {
      const rows = await db.select().from(managedAccounts).orderBy(desc(managedAccounts.createdAt)).limit(EXPORT_LIMIT)
      return toCsv(
        ["id", "label", "email", "provider", "status", "creditBalance", "monthlyCreditLimit", "notes", "archivedAt", "createdAt"],
        rows.map((row) => ({ ...row, archivedAt: iso(row.archivedAt), createdAt: iso(row.createdAt) })),
      )
    }
    case "campaigns": {
      const rows = await db.select().from(campaigns).orderBy(desc(campaigns.createdAt)).limit(EXPORT_LIMIT)
      return toCsv(
        ["id", "name", "platform", "rewardPerConversion", "currency", "monthlyLimit", "active", "referralUrl", "archivedAt", "createdAt"],
        rows.map((row) => ({ ...row, archivedAt: iso(row.archivedAt), createdAt: iso(row.createdAt) })),
      )
    }
    case "customers": {
      const rows = await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(EXPORT_LIMIT)
      return toCsv(
        ["id", "name", "email", "phone", "notes", "archivedAt", "createdAt"],
        rows.map((row) => ({ ...row, archivedAt: iso(row.archivedAt), createdAt: iso(row.createdAt) })),
      )
    }
    case "orders": {
      const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(EXPORT_LIMIT)
      return toCsv(
        ["id", "customerId", "description", "creditAmount", "salePrice", "costPrice", "currency", "status", "paidAt", "deliveredAt", "createdAt"],
        rows.map((row) => ({ ...row, paidAt: iso(row.paidAt), deliveredAt: iso(row.deliveredAt), createdAt: iso(row.createdAt) })),
      )
    }
    case "credit_ledger": {
      const rows = await db.select().from(creditLedger).orderBy(desc(creditLedger.occurredAt)).limit(EXPORT_LIMIT)
      return toCsv(
        ["id", "managedAccountId", "campaignId", "referralId", "type", "amount", "currency", "status", "description", "occurredAt", "createdAt"],
        rows.map((row) => ({ ...row, occurredAt: iso(row.occurredAt), createdAt: iso(row.createdAt) })),
      )
    }
    default:
      throw new Error("Entidade de exportação inválida.")
  }
}

export const exportService = {
  entities: EXPORT_ENTITIES,
  resource: exportResource,
  csv: exportEntityCsv,
}
