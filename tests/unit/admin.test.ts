import { describe, expect, it } from "vitest"

import { sanitizeActivityMetadata } from "@/lib/admin/activity-metadata"
import {
  campaignFormSchema,
  creditLedgerFormSchema,
  customerFormSchema,
  managedAccountFormSchema,
  orderFormSchema,
  orderTransitionFormSchema,
  parseForm,
  referralTransitionFormSchema,
  settingFormSchema,
} from "@/lib/admin/form-schemas"
import {
  addDecimals,
  assertNonNegativeDecimal,
  centsToDecimal,
  decimalToCents,
  formatMoney,
  subtractDecimals,
} from "@/lib/admin/money"
import { normalizeEmail, normalizePhone, normalizeRequiredEmail } from "@/lib/admin/normalize"
import { makePaginatedResult, normalizeListParams } from "@/lib/admin/pagination"
import {
  assertOrderTransition,
  assertReferralTransition,
  canTransitionOrder,
  canTransitionReferral,
  grossProfit,
} from "@/lib/admin/status"
import { editableSettings, isEditableSettingKey, updateEditableSetting } from "@/lib/services/settings-service"

describe("money (no float, BigInt cents)", () => {
  it("converts decimals to cents and back without precision loss", () => {
    expect(decimalToCents("10.50")).toBe(1050n)
    expect(decimalToCents("0.01")).toBe(1n)
    expect(decimalToCents("-3.30")).toBe(-330n)
    expect(centsToDecimal(1050n)).toBe("10.50")
    expect(centsToDecimal(-330n)).toBe("-3.30")
    expect(centsToDecimal(5n)).toBe("0.05")
  })

  it("adds and subtracts exactly (0.1 + 0.2 problem)", () => {
    expect(addDecimals(["0.10", "0.20"])).toBe("0.30")
    expect(addDecimals(["100.00", "25.50", "-5.50"])).toBe("120.00")
    expect(subtractDecimals("10.00", "3.33")).toBe("6.67")
  })

  it("formats money with a currency and rejects negatives when required", () => {
    expect(formatMoney("1234.50", "USD")).toContain("1.234,50")
    expect(() => assertNonNegativeDecimal("-0.01", "Valor")).toThrow("não pode ser negativo")
    expect(() => assertNonNegativeDecimal("0.00")).not.toThrow()
  })
})

describe("profit calculation", () => {
  it("computes gross profit as sale minus cost", () => {
    expect(grossProfit("20.00", "5.50")).toBe("14.50")
    expect(grossProfit("5.00", "9.00")).toBe("-4.00")
  })
})

describe("referral transitions", () => {
  it("allows valid transitions and blocks invalid ones", () => {
    expect(canTransitionReferral("pending", "invited")).toBe(true)
    expect(canTransitionReferral("pending", "approved")).toBe(false)
    expect(canTransitionReferral("approved", "pending")).toBe(false)
  })

  it("permits administrative override", () => {
    expect(canTransitionReferral("approved", "pending", true)).toBe(true)
    expect(() => assertReferralTransition("pending", "approved")).toThrow("Transição de indicação inválida")
    expect(() => assertReferralTransition("pending", "approved", true)).not.toThrow()
  })
})

describe("order transitions", () => {
  it("allows valid transitions and blocks invalid ones", () => {
    expect(canTransitionOrder("draft", "pending_payment")).toBe(true)
    expect(canTransitionOrder("draft", "delivered")).toBe(false)
    expect(canTransitionOrder("paid", "processing")).toBe(true)
    expect(() => assertOrderTransition("draft", "delivered")).toThrow("Transição de pedido inválida")
  })
})

describe("email and phone normalization", () => {
  it("normalizes email casing and trims, returns null for empty", () => {
    expect(normalizeEmail("  User@Example.COM ")).toBe("user@example.com")
    expect(normalizeEmail("")).toBeNull()
    expect(normalizeEmail(null)).toBeNull()
    expect(normalizeRequiredEmail("A@B.com")).toBe("a@b.com")
    expect(() => normalizeRequiredEmail("   ")).toThrow("E-mail inválido")
  })

  it("keeps only digits and plus in phones", () => {
    expect(normalizePhone("+55 (11) 99999-8888")).toBe("+5511999998888")
    expect(normalizePhone("")).toBeNull()
  })
})

describe("list params and pagination", () => {
  it("clamps page size to 1..100 and computes offset", () => {
    expect(normalizeListParams({ page: "3", pageSize: "25" })).toMatchObject({ page: 3, pageSize: 25, offset: 50 })
    expect(normalizeListParams({ pageSize: "500" }).pageSize).toBe(100)
    expect(normalizeListParams({ page: "-2" }).page).toBe(1)
  })

  it("normalizes text filters and the unread flag", () => {
    const params = normalizeListParams({ q: "  hello ", unread: "true" })
    expect(params.q).toBe("hello")
    expect(params.unread).toBe(true)
    expect(normalizeListParams({ unread: "false" }).unread).toBe(false)
    expect(normalizeListParams({}).unread).toBeUndefined()
  })

  it("builds paginated result metadata", () => {
    const result = makePaginatedResult([1, 2, 3], 45, { page: 2, pageSize: 20 })
    expect(result).toMatchObject({ total: 45, page: 2, pageSize: 20, totalPages: 3 })
  })
})

describe("form schemas", () => {
  it("lowercases managed account email and defaults money/status", () => {
    const parsed = managedAccountFormSchema.parse({
      label: "Conta Norte",
      email: "OWNER@Example.COM",
      provider: "Prov",
      monthlyCreditLimit: "150.00",
      notes: "",
      lastCheckedAt: "",
      status: "active",
    })
    expect(parsed.email).toBe("owner@example.com")
    expect(parsed.monthlyCreditLimit).toBe("150.00")
    expect(parsed.notes).toBeNull()
  })

  it("rejects an invalid managed account email", () => {
    expect(() =>
      managedAccountFormSchema.parse({
        label: "X",
        email: "not-an-email",
        provider: "P",
        monthlyCreditLimit: "0",
        notes: "",
        lastCheckedAt: "",
      }),
    ).toThrow()
  })

  it("only allows negative ledger amounts for adjustments", () => {
    const base = {
      managedAccountId: "acc",
      campaignId: "",
      referralId: "",
      currency: "USD",
      status: "pending",
      description: "",
    }
    expect(() => creditLedgerFormSchema.parse({ ...base, type: "spent", amount: "-10.00" })).toThrow(
      "Somente ajustes podem ter valor negativo",
    )
    expect(creditLedgerFormSchema.parse({ ...base, type: "adjustment", amount: "-10.00" }).amount).toBe("-10.00")
    expect(creditLedgerFormSchema.parse({ ...base, type: "earned", amount: "10.00" }).campaignId).toBeNull()
  })

  it("rejects negative money on orders and campaigns", () => {
    expect(() =>
      orderFormSchema.parse({
        customerId: "c",
        description: "Pedido",
        creditAmount: "0",
        salePrice: "-1.00",
        costPrice: "0",
        currency: "USD",
        status: "draft",
      }),
    ).toThrow()
    expect(() =>
      campaignFormSchema.parse({
        name: "C",
        platform: "P",
        referralUrl: "",
        rewardPerConversion: "-5.00",
        monthlyLimit: "",
        currency: "USD",
        active: "true",
        termsUrl: "",
        notes: "",
      }),
    ).toThrow()
  })

  it("turns empty optional customer email into null", () => {
    expect(customerFormSchema.parse({ name: "Cliente", email: "", phone: "", notes: "" }).email).toBeNull()
    expect(customerFormSchema.parse({ name: "Cliente", email: "PERSON@X.com", phone: "", notes: "" }).email).toBe(
      "person@x.com",
    )
  })

  it("validates transition and setting schemas", () => {
    expect(referralTransitionFormSchema.parse({ id: "r1", status: "invited" }).status).toBe("invited")
    expect(orderTransitionFormSchema.parse({ id: "o1", status: "paid" }).status).toBe("paid")
    expect(() => settingFormSchema.parse({ key: "app.currency", value: "" })).toThrow()
  })

  it("parses a FormData payload", () => {
    const fd = new FormData()
    fd.set("name", "Via Form")
    fd.set("email", "")
    fd.set("phone", "")
    fd.set("notes", "")
    expect(parseForm(customerFormSchema, fd).name).toBe("Via Form")
  })
})

describe("settings per key", () => {
  it("recognizes only whitelisted editable keys", () => {
    expect(isEditableSettingKey("app.currency")).toBe(true)
    expect(isEditableSettingKey("app.locale")).toBe(true)
    expect(isEditableSettingKey("app.timezone")).toBe(true)
    expect(isEditableSettingKey("app.defaultMonthlyLimit")).toBe(true)
    expect(isEditableSettingKey("BETTER_AUTH_SECRET")).toBe(false)
    expect(isEditableSettingKey("DATABASE_URL")).toBe(false)
    expect(isEditableSettingKey("app.secret")).toBe(false)
  })

  it("validates values per key", () => {
    expect(editableSettings["app.currency"].parse("USD")).toBe("USD")
    expect(() => editableSettings["app.currency"].parse("US")).toThrow()
    expect(editableSettings["app.defaultMonthlyLimit"].parse(100)).toBe("100")
  })

  it("refuses to update a non-editable (secret) key before touching the database", async () => {
    await expect(updateEditableSetting("BETTER_AUTH_SECRET", "leak", {} as never)).rejects.toThrow(
      "Configuração não editável",
    )
    await expect(updateEditableSetting("DATABASE_URL", "leak", {} as never)).rejects.toThrow()
  })
})

describe("activity metadata sanitization", () => {
  it("removes sensitive keys and keeps safe ones", () => {
    const clean = sanitizeActivityMetadata({
      status: "active",
      provider: "Prov",
      password: "hunter2",
      token: "abc",
      sessionId: "s",
      hash: "h",
      cookie: "c",
      authorization: "Bearer x",
      apiKey: "k",
      senha: "segredo",
    })
    expect(clean).toEqual({ status: "active", provider: "Prov" })
  })

  it("keeps reconciliation report metadata and handles null", () => {
    expect(sanitizeActivityMetadata({ persisted: "10.00", calculated: "9.00", diverged: true })).toEqual({
      persisted: "10.00",
      calculated: "9.00",
      diverged: true,
    })
    expect(sanitizeActivityMetadata(null)).toEqual({})
    expect(sanitizeActivityMetadata(undefined)).toEqual({})
  })
})
