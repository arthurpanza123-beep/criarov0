import { randomUUID } from "node:crypto"

import { eq } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { config } from "dotenv"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { closeDatabaseClient, createDatabaseClient } from "@/lib/db"
import {
  activities,
  campaigns,
  creditLedger,
  customers,
  managedAccounts,
  notifications,
  orders,
  referrals,
  settings,
  user,
} from "@/lib/db/schema"
import { recordAdminActivity } from "@/lib/admin/audit"
import { can } from "@/lib/auth/permissions"
import { accountBalanceService } from "@/lib/services/account-balance-service"
import { activitiesService } from "@/lib/services/activity-log-service"
import { campaignsService } from "@/lib/services/campaigns-service"
import { creditLedgerService } from "@/lib/services/credit-ledger-service"
import { customersService } from "@/lib/services/customers-service"
import { getDashboardMetrics } from "@/lib/services/dashboard-service"
import { managedAccountsService } from "@/lib/services/managed-accounts-service"
import { notificationsService } from "@/lib/services/notifications-service"
import { ordersService } from "@/lib/services/orders-service"
import { referralsService } from "@/lib/services/referrals-service"
import { settingsService } from "@/lib/services/settings-service"

config({ path: ".env.local", quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL

// Explicit destructive guard: these tests wipe domain tables, so they must only
// ever run against criarov0_test. Refuse to run against anything else.
if (!testDatabaseUrl || !/\/criarov0_test(?:\?|$)/.test(testDatabaseUrl)) {
  throw new Error("Integration CRUD tests require TEST_DATABASE_URL pointing to criarov0_test.")
}

// Point the services' singleton getDb() at the test database.
process.env.DATABASE_URL = testDatabaseUrl

const client = createDatabaseClient(testDatabaseUrl)
const db = client.db

let actorId: string

async function cleanupDomain() {
  await db.delete(creditLedger)
  await db.delete(orders)
  await db.delete(referrals)
  await db.delete(managedAccounts)
  await db.delete(campaigns)
  await db.delete(customers)
  await db.delete(activities)
  await db.delete(notifications)
  await db.delete(settings)
}

async function createAccount(overrides: Partial<{ label: string; email: string; provider: string; monthlyCreditLimit: string }> = {}) {
  return managedAccountsService.create({
    label: overrides.label ?? "Conta Teste",
    email: overrides.email ?? `acc-${randomUUID()}@example.crud`,
    provider: overrides.provider ?? "Plataforma",
    monthlyCreditLimit: overrides.monthlyCreditLimit ?? "100.00",
  })
}

describe("phase 5 crud integration (criarov0_test)", () => {
  beforeAll(async () => {
    await migrate(db, { migrationsFolder: "lib/db/migrations" })
    await cleanupDomain()
    await db.delete(user).where(eq(user.email, "crud-actor@example.crud"))
    const [row] = await db
      .insert(user)
      .values({ name: "CRUD Actor", email: "crud-actor@example.crud", role: "owner", mustChangePassword: false })
      .returning()
    actorId = row.id
  })

  beforeEach(async () => {
    await cleanupDomain()
  })

  afterAll(async () => {
    await cleanupDomain()
    await db.delete(user).where(eq(user.email, "crud-actor@example.crud"))
    await closeDatabaseClient(client)
  })

  describe("managed accounts", () => {
    it("creates, normalizes email, updates, archives and restores", async () => {
      const account = await createAccount({ email: "CONTA@Example.CRUD" })
      expect(account.email).toBe("conta@example.crud")
      expect(account.creditBalance).toBe("0.00")

      const updated = await managedAccountsService.update(account.id, { provider: "Nova Plataforma" })
      expect(updated?.provider).toBe("Nova Plataforma")

      const archived = await managedAccountsService.archive(account.id)
      expect(archived?.archivedAt).toBeInstanceOf(Date)
      expect(archived?.status).toBe("archived")

      const restored = await managedAccountsService.restore(account.id)
      expect(restored?.archivedAt).toBeNull()
      expect(restored?.status).toBe("active")
    })

    it("rejects negative monthly limit", async () => {
      await expect(createAccount({ monthlyCreditLimit: "-1.00" })).rejects.toThrow("não pode ser negativo")
    })

    it("filters archived and paginates", async () => {
      const a = await createAccount()
      await createAccount()
      await managedAccountsService.archive(a.id)

      const active = await managedAccountsService.list({ status: "" })
      expect(active.total).toBe(1)

      const archived = await managedAccountsService.list({ status: "archived" })
      expect(archived.total).toBe(1)

      const paged = await managedAccountsService.list({ pageSize: "1" })
      expect(paged.pageSize).toBe(1)
      expect(paged.data).toHaveLength(1)
    })
  })

  describe("campaigns", () => {
    it("creates, updates, archives and restores", async () => {
      const campaign = await campaignsService.create({ name: "Camp", platform: "Plat", rewardPerConversion: "5.00", currency: "USD" })
      expect(campaign.active).toBe(true)

      const updated = await campaignsService.update(campaign.id, { name: "Camp 2" })
      expect(updated?.name).toBe("Camp 2")

      const archived = await campaignsService.archive(campaign.id)
      expect(archived?.archivedAt).toBeInstanceOf(Date)
      expect(archived?.active).toBe(false)

      const restored = await campaignsService.restore(campaign.id)
      expect(restored?.archivedAt).toBeNull()
    })
  })

  describe("referrals", () => {
    it("creates and transitions through the valid flow", async () => {
      const campaign = await campaignsService.create({ name: "C", platform: "P", rewardPerConversion: "1.00", currency: "USD" })
      const referral = await referralsService.create({
        campaignId: campaign.id,
        contactName: "Contato",
        contactEmail: "LEAD@Example.CRUD",
        expectedReward: "5.00",
      })
      expect(referral.contactEmail).toBe("lead@example.crud")

      const invited = await referralsService.transition(referral.id, "invited")
      expect(invited.status).toBe("invited")
      expect(invited.invitedAt).toBeInstanceOf(Date)

      const registered = await referralsService.transition(referral.id, "registered")
      expect(registered.status).toBe("registered")

      const approved = await referralsService.approve(referral.id, "4.50")
      expect(approved.status).toBe("approved")
      expect(approved.approvedReward).toBe("4.50")
    })

    it("blocks an invalid transition unless administrative", async () => {
      const campaign = await campaignsService.create({ name: "C", platform: "P", rewardPerConversion: "1.00", currency: "USD" })
      const referral = await referralsService.create({ campaignId: campaign.id, contactName: "X", expectedReward: "1.00" })
      await expect(referralsService.transition(referral.id, "approved")).rejects.toThrow("Transição de indicação inválida")
      const forced = await referralsService.transition(referral.id, "approved", true)
      expect(forced.status).toBe("approved")
    })

    it("archives and restores", async () => {
      const campaign = await campaignsService.create({ name: "C", platform: "P", rewardPerConversion: "1.00", currency: "USD" })
      const referral = await referralsService.create({ campaignId: campaign.id, contactName: "X", expectedReward: "1.00" })
      const archived = await referralsService.archive(referral.id)
      expect(archived.status).toBe("archived")
      const restored = await referralsService.restore(referral.id)
      expect(restored?.archivedAt).toBeNull()
    })
  })

  describe("customers and orders", () => {
    it("creates a customer and runs the order lifecycle", async () => {
      const customer = await customersService.create({ name: "Cliente", email: "CLI@Example.CRUD" })
      expect(customer.email).toBe("cli@example.crud")

      const order = await ordersService.create({
        customerId: customer.id,
        description: "Pedido",
        creditAmount: "0",
        salePrice: "20.00",
        costPrice: "5.00",
        currency: "USD",
      })
      expect(order.status).toBe("draft")

      const pending = await ordersService.transition(order.id, "pending_payment")
      expect(pending.status).toBe("pending_payment")
      const paid = await ordersService.transition(order.id, "paid")
      expect(paid.status).toBe("paid")
      expect(paid.paidAt).toBeInstanceOf(Date)

      await expect(ordersService.transition(order.id, "draft")).rejects.toThrow("Transição de pedido inválida")

      const archived = await ordersService.archive(order.id)
      expect(archived?.archivedAt).toBeInstanceOf(Date)
      const restored = await ordersService.restore(order.id)
      expect(restored?.archivedAt).toBeNull()
    })

    it("rejects negative order money", async () => {
      const customer = await customersService.create({ name: "Cliente" })
      await expect(
        ordersService.create({ customerId: customer.id, description: "P", creditAmount: "0", salePrice: "-1.00", costPrice: "0", currency: "USD" }),
      ).rejects.toThrow("não pode ser negativo")
    })

    it("orders newest first", async () => {
      const customer = await customersService.create({ name: "Cliente" })
      await db.insert(orders).values({ customerId: customer.id, description: "old", salePrice: "1.00", costPrice: "0", creditAmount: "0", currency: "USD", createdAt: new Date("2020-01-01T00:00:00Z") })
      await db.insert(orders).values({ customerId: customer.id, description: "new", salePrice: "1.00", costPrice: "0", creditAmount: "0", currency: "USD", createdAt: new Date("2024-01-01T00:00:00Z") })
      const list = await ordersService.list()
      expect(list.data[0]?.description).toBe("new")
    })
  })

  describe("credit ledger and balance", () => {
    it("enforces non-negative amounts except for adjustments", async () => {
      const account = await createAccount()
      await expect(
        creditLedgerService.create({ managedAccountId: account.id, type: "spent", amount: "-5.00", currency: "USD" }),
      ).rejects.toThrow("não pode ser negativo")
      const adjustment = await creditLedgerService.create({ managedAccountId: account.id, type: "adjustment", amount: "-5.00", currency: "USD" })
      expect(adjustment.amount).toBe("-5.00")
    })

    it("confirms, cancels and preserves history (never deletes)", async () => {
      const account = await createAccount()
      const entry = await creditLedgerService.create({ managedAccountId: account.id, type: "earned", amount: "10.00", currency: "USD", status: "pending" })

      const confirmed = await creditLedgerService.confirm(entry.id)
      expect(confirmed.status).toBe("confirmed")

      const cancelled = await creditLedgerService.cancel(entry.id)
      expect(cancelled.status).toBe("cancelled")

      // The row is preserved, not deleted.
      const [stillThere] = await db.select().from(creditLedger).where(eq(creditLedger.id, entry.id))
      expect(stillThere?.id).toBe(entry.id)
    })

    it("computes the confirmed balance from the ledger", async () => {
      const account = await createAccount()
      await creditLedgerService.create({ managedAccountId: account.id, type: "earned", amount: "100.00", currency: "USD", status: "confirmed" })
      await creditLedgerService.create({ managedAccountId: account.id, type: "spent", amount: "30.00", currency: "USD", status: "confirmed" })
      await creditLedgerService.create({ managedAccountId: account.id, type: "earned", amount: "999.00", currency: "USD", status: "pending" })
      const balance = await accountBalanceService.calculateManagedAccountBalance(account.id, db)
      expect(balance).toBe(70)
    })
  })

  describe("ledger reconciliation", () => {
    it("reports agreement, detects divergence and never auto-corrects the account", async () => {
      const account = await createAccount()
      const consistent = await creditLedgerService.reconcile(account.id)
      expect(consistent.diverged).toBe(false)

      await creditLedgerService.create({ managedAccountId: account.id, type: "earned", amount: "10.00", currency: "USD", status: "confirmed" })
      const report = await creditLedgerService.reconcile(account.id)
      expect(report.calculated).toBe("10.00")
      expect(report.persisted).toBe("0.00")
      expect(report.diverged).toBe(true)

      // Reconciliation is read-only: the persisted balance must be untouched.
      const [after] = await db.select().from(managedAccounts).where(eq(managedAccounts.id, account.id))
      expect(after?.creditBalance).toBe("0.00")
    })
  })

  describe("dashboard metrics", () => {
    it("aggregates real metrics over a date range without error", async () => {
      const account = await createAccount({ monthlyCreditLimit: "500.00" })
      await creditLedgerService.create({ managedAccountId: account.id, type: "earned", amount: "100.00", currency: "USD", status: "confirmed" })
      await creditLedgerService.create({ managedAccountId: account.id, type: "spent", amount: "30.00", currency: "USD", status: "confirmed" })
      const customer = await customersService.create({ name: "Cliente Dash" })
      await ordersService.create({ customerId: customer.id, description: "Pedido", creditAmount: "0", salePrice: "50.00", costPrice: "20.00", currency: "USD", status: "draft" })

      const metrics = await getDashboardMetrics({ range: "30d" })
      expect(metrics.accounts.active).toBe(1)
      expect(metrics.ledger.confirmedBalance).toBe("70.00")
      expect(metrics.customers.active).toBe(1)
      expect(Array.isArray(metrics.recentActivities)).toBe(true)
    })

    it("supports an explicit custom range (exercises the timestamp-bound query)", async () => {
      const metrics = await getDashboardMetrics({ range: "custom", from: "2020-01-01", to: "2030-01-01" })
      expect(metrics.range.range).toBe("custom")
      expect(typeof metrics.ledger.spentInPeriod).toBe("string")
    })
  })

  describe("activities", () => {
    it("persists sanitized metadata and lists with actor join", async () => {
      const account = await createAccount()
      await recordAdminActivity({
        actorUserId: actorId,
        entityType: "managed_account",
        entityId: account.id,
        action: "managed_account_created",
        metadata: { status: "active", password: "secret", token: "abc" },
      })

      const [stored] = await db.select().from(activities).where(eq(activities.entityId, account.id))
      expect(stored?.metadata).toEqual({ status: "active" })

      const listed = await activitiesService.list({})
      expect(listed.total).toBe(1)
      expect(listed.data[0]?.actorName).toBe("CRUD Actor")
    })
  })

  describe("notifications", () => {
    it("creates, filters unread/read and marks read", async () => {
      await notificationsService.create({ title: "Um", message: "m1", type: "info" })
      const second = await notificationsService.create({ title: "Dois", message: "m2", type: "warning" })

      expect(await notificationsService.unreadCount()).toBe(2)
      expect((await notificationsService.list({ unread: "true" })).total).toBe(2)

      await notificationsService.markRead(second.id)
      expect(await notificationsService.unreadCount()).toBe(1)
      expect((await notificationsService.list({ unread: "false" })).total).toBe(1)

      await notificationsService.markAllRead()
      expect(await notificationsService.unreadCount()).toBe(0)
    })
  })

  describe("settings per key", () => {
    it("persists editable keys and rejects non-editable keys", async () => {
      await settingsService.updateEditable("app.currency", "BRL", db)
      const [row] = await db.select().from(settings).where(eq(settings.key, "app.currency"))
      expect(row?.value).toBe("BRL")

      await settingsService.updateEditable("app.defaultMonthlyLimit", 250, db)
      const [limit] = await db.select().from(settings).where(eq(settings.key, "app.defaultMonthlyLimit"))
      expect(String(limit?.value)).toBe("250")

      await expect(settingsService.updateEditable("BETTER_AUTH_SECRET", "leak", db)).rejects.toThrow("não editável")
      const secret = await db.select().from(settings).where(eq(settings.key, "BETTER_AUTH_SECRET"))
      expect(secret).toHaveLength(0)
    })
  })

  describe("rbac matrix and mutation blocking", () => {
    it("grants the owner full control", () => {
      for (const resource of ["managedAccounts", "campaigns", "referrals", "customers", "orders", "creditLedger", "settings"] as const) {
        expect(can("owner", resource, "create")).toBe(true)
        expect(can("owner", resource, "manage")).toBe(true)
        expect(can("owner", resource, "archive")).toBe(true)
      }
      expect(can("owner", "users", "manage")).toBe(true)
    })

    it("limits admin away from ledger-manage, settings-manage and users", () => {
      expect(can("admin", "campaigns", "manage")).toBe(true)
      expect(can("admin", "creditLedger", "create")).toBe(true)
      expect(can("admin", "creditLedger", "manage")).toBe(false)
      expect(can("admin", "settings", "update")).toBe(true)
      expect(can("admin", "settings", "manage")).toBe(false)
      expect(can("admin", "users", "manage")).toBe(false)
    })

    it("limits operator to its assigned mutations", () => {
      expect(can("operator", "referrals", "create")).toBe(true)
      expect(can("operator", "referrals", "update")).toBe(true)
      expect(can("operator", "referrals", "manage")).toBe(false)
      expect(can("operator", "orders", "update")).toBe(true)
      expect(can("operator", "managedAccounts", "update")).toBe(true)
      expect(can("operator", "managedAccounts", "manage")).toBe(false)
      expect(can("operator", "creditLedger", "create")).toBe(false)
      expect(can("operator", "customers", "create")).toBe(false)
    })

    it("blocks every mutation for viewer while allowing reads", () => {
      for (const resource of ["managedAccounts", "campaigns", "referrals", "customers", "orders", "creditLedger", "settings", "activities"] as const) {
        expect(can("viewer", resource, "read")).toBe(true)
        expect(can("viewer", resource, "create")).toBe(false)
        expect(can("viewer", resource, "update")).toBe(false)
        expect(can("viewer", resource, "archive")).toBe(false)
        expect(can("viewer", resource, "manage")).toBe(false)
      }
    })
  })
})
