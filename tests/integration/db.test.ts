import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import { config } from "dotenv"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { GET as databaseHealth } from "@/app/api/health/database/route"
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
} from "@/lib/db/schema"
import {
  createCampaignsRepository,
  createCreditLedgerRepository,
  createCustomersRepository,
  createManagedAccountsRepository,
  createReferralsRepository,
  createSettingsRepository,
} from "@/lib/repositories"
import { calculateConfirmedLedgerBalance } from "@/lib/services"
import { settingsService } from "@/lib/services/settings-service"

config({ path: ".env.local", quiet: true })

const testDatabaseUrl = process.env.TEST_DATABASE_URL

if (!testDatabaseUrl || !/\/criarov0_test(?:\?|$)/.test(testDatabaseUrl)) {
  throw new Error("Integration tests require TEST_DATABASE_URL pointing to criarov0_test.")
}

const client = createDatabaseClient(testDatabaseUrl)
const db = client.db

async function cleanup() {
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

describe("postgres persistence", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = testDatabaseUrl
    await migrate(db, { migrationsFolder: "lib/db/migrations" })
  })

  beforeEach(async () => {
    await cleanup()
  })

  afterAll(async () => {
    await cleanup()
    await closeDatabaseClient(client)
  })

  it("connects to the test database", async () => {
    const result = await db.execute(sql<{ value: number }>`select 1 as value`)
    expect(result[0]?.value).toBe(1)
  })

  it("creates and reads managed accounts, campaigns, referrals and ledger entries", async () => {
    const accountsRepository = createManagedAccountsRepository(db)
    const campaignsRepository = createCampaignsRepository(db)
    const referralsRepository = createReferralsRepository(db)
    const ledgerRepository = createCreditLedgerRepository(db)

    const account = await accountsRepository.create({
      label: "Conta Teste",
      email: "CONTA.TESTE@example.com",
      provider: "Plataforma Teste",
      creditBalance: "0",
      monthlyCreditLimit: "200",
    })
    expect(account.email).toBe("conta.teste@example.com")

    const campaign = await campaignsRepository.create({
      name: "Campanha Teste",
      platform: "Plataforma Teste",
      rewardPerConversion: "10",
      monthlyLimit: 10,
      currency: "USD",
    })

    const referral = await referralsRepository.create({
      campaignId: campaign.id,
      contactName: "Contato Teste",
      contactEmail: "CONTATO@example.com",
      expectedReward: "10",
    })
    expect(referral.contactEmail).toBe("contato@example.com")

    await ledgerRepository.create({
      managedAccountId: account.id,
      campaignId: campaign.id,
      referralId: referral.id,
      type: "earned",
      amount: "10",
      currency: "USD",
      status: "confirmed",
    })
    await ledgerRepository.create({
      managedAccountId: account.id,
      type: "spent",
      amount: "3",
      currency: "USD",
      status: "confirmed",
    })

    const entries = await ledgerRepository.list({ limit: 10 })
    expect(calculateConfirmedLedgerBalance(entries)).toBe(7)
    expect(await accountsRepository.findById(account.id)).toMatchObject({ id: account.id })
  })

  it("enforces foreign keys", async () => {
    const referralsRepository = createReferralsRepository(db)

    await expect(referralsRepository.create({
      campaignId: randomUUID(),
      contactName: "Contato sem campanha",
      expectedReward: "10",
    })).rejects.toThrow()
  })

  it("archives rows without deleting them", async () => {
    const customersRepository = createCustomersRepository(db)
    const customer = await customersRepository.create({
      name: "Cliente Teste",
      email: "CLIENTE@example.com",
    })

    const archived = await customersRepository.archive(customer.id)
    expect(archived?.archivedAt).toBeInstanceOf(Date)
    expect(await customersRepository.findById(customer.id)).toMatchObject({ id: customer.id })
  })

  it("upserts settings idempotently", async () => {
    const settingsRepository = createSettingsRepository(db)

    await settingsRepository.upsert("app.currency", "USD")
    await settingsRepository.upsert("app.currency", "USD")

    const rows = await settingsRepository.list({ limit: 10 })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: "app.currency", value: "USD" })
  })

  it("runs the seed settings idempotently", async () => {
    await settingsService.upsert("app.currency", "USD", db)
    await settingsService.upsert("app.currency", "USD", db)

    const rows = await db.select().from(settings)
    expect(rows.filter((row) => row.key === "app.currency")).toHaveLength(1)
  })

  it("returns database health without sensitive details", async () => {
    const response = await databaseHealth()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(body).toEqual({
      status: "ok",
      database: "reachable",
      timestamp: expect.any(String),
    })
    expect(Object.keys(body).sort()).toEqual(["database", "status", "timestamp"])
  })
})
