import { describe, expect, it } from "vitest"

import { normalizePagination } from "@/lib/repositories"
import { calculateConfirmedLedgerBalance } from "@/lib/services"
import {
  campaignSchema,
  creditLedgerEntrySchema,
  managedAccountSchema,
  orderSchema,
  userRoleSchema,
} from "@/lib/validators"

const now = new Date().toISOString()

describe("domain schemas", () => {
  it("accepts valid statuses and roles", () => {
    expect(userRoleSchema.parse("owner")).toBe("owner")
    expect(managedAccountSchema.parse({
      id: "acc_1",
      label: "Conta Norte",
      email: "norte@example.com",
      provider: "Plataforma A",
      status: "suspended",
      creditBalance: 0,
      monthlyCreditLimit: 200,
      notes: null,
      lastCheckedAt: null,
      createdAt: now,
      updatedAt: now,
    }).status).toBe("suspended")
  })

  it("rejects invalid monetary values where the domain requires non-negative values", () => {
    expect(campaignSchema.safeParse({
      id: "camp_1",
      name: "Campanha",
      platform: "Plataforma A",
      referralUrl: null,
      rewardPerConversion: -1,
      monthlyLimit: null,
      active: true,
      termsUrl: null,
      notes: null,
      createdAt: now,
      updatedAt: now,
    }).success).toBe(false)

    expect(orderSchema.safeParse({
      id: "order_1",
      customerId: "customer_1",
      description: "Pedido",
      creditAmount: 10,
      salePrice: 20,
      costPrice: -1,
      status: "paid",
      paidAt: null,
      deliveredAt: null,
      createdAt: now,
      updatedAt: now,
    }).success).toBe(false)
  })

  it("allows signed adjustment entries in the ledger validator", () => {
    expect(creditLedgerEntrySchema.parse({
      id: "ledger_1",
      managedAccountId: "account_1",
      campaignId: null,
      referralId: null,
      type: "adjustment",
      amount: -10,
      currency: "USD",
      status: "confirmed",
      description: null,
      occurredAt: now,
      createdAt: now,
    }).amount).toBe(-10)
  })
})

describe("ledger balance", () => {
  it("calculates confirmed balance using ledger signs", () => {
    const balance = calculateConfirmedLedgerBalance([
      { type: "earned", amount: "100.00", status: "confirmed" },
      { type: "sale", amount: "25.00", status: "confirmed" },
      { type: "adjustment", amount: "-5.00", status: "confirmed" },
      { type: "spent", amount: "30.00", status: "confirmed" },
      { type: "expired", amount: "10.00", status: "confirmed" },
      { type: "earned", amount: "999.00", status: "pending" },
    ])

    expect(balance).toBe(80)
  })
})

describe("pagination", () => {
  it("clamps limit and offset", () => {
    expect(normalizePagination({ limit: 500, offset: -10 })).toEqual({
      limit: 100,
      offset: 0,
    })
    expect(normalizePagination({ limit: 0, offset: 5 })).toEqual({
      limit: 1,
      offset: 5,
    })
  })
})
