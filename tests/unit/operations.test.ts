import { describe, expect, it } from "vitest"

import { parseCsv, parseCsvRecords, toCsv } from "@/lib/admin/csv"
import { safeErrorMessage } from "@/lib/observability/errors"
import { sanitizeLogValue } from "@/lib/observability/logger"
import { computeBackoffMs } from "@/lib/services/jobs-service"
import { simulate, type SimulatorData } from "@/lib/services/simulator-service"

describe("queue backoff", () => {
  it("grows exponentially and caps", () => {
    expect(computeBackoffMs(0)).toBe(0)
    expect(computeBackoffMs(1, 2000)).toBe(2000)
    expect(computeBackoffMs(2, 2000)).toBe(4000)
    expect(computeBackoffMs(3, 2000)).toBe(8000)
    expect(computeBackoffMs(100, 2000, 300000)).toBe(300000) // capped
  })
})

describe("csv parser", () => {
  it("parses quoted fields, escaped quotes and embedded commas", () => {
    const rows = parseCsv('a,b\n"x,y","z""q"\n1,2')
    expect(rows).toEqual([
      ["a", "b"],
      ["x,y", 'z"q'],
      ["1", "2"],
    ])
  })

  it("maps records against headers and skips blank lines", () => {
    const { headers, records } = parseCsvRecords("name,email\nAlice,a@x.com\n\nBob,b@x.com\n")
    expect(headers).toEqual(["name", "email"])
    expect(records).toEqual([
      { name: "Alice", email: "a@x.com" },
      { name: "Bob", email: "b@x.com" },
    ])
  })

  it("serializes with escaping and CRLF", () => {
    const csv = toCsv(["a", "b"], [{ a: "1", b: "x,y" }, { a: 'has"quote', b: "n\nl" }])
    expect(csv).toBe('a,b\r\n1,"x,y"\r\n"has""quote","n\nl"')
  })

  it("neutralizes formula injection for fields starting with =, +, -, @, tab or CR", () => {
    const csv = toCsv(["formula", "safe"], [
      { formula: "=cmd|'/c calc'!A1", safe: "ok" },
      { formula: "+1+1", safe: "ok" },
      { formula: "-1+1", safe: "ok" },
      { formula: "@SUM(1+1)", safe: "ok" },
    ])
    const lines = csv.split("\r\n").slice(1)
    expect(lines[0]).toBe("'=cmd|'/c calc'!A1,ok")
    expect(lines[1]).toBe("'+1+1,ok")
    expect(lines[2]).toBe("'-1+1,ok")
    expect(lines[3]).toBe("'@SUM(1+1),ok")
  })
})

describe("financial simulator", () => {
  const data: SimulatorData = {
    activeAccounts: 3,
    totalMonthlyLimitCents: 60_000n, // 600.00
    confirmedBalanceCents: 7_000n, // 70.00
    spentCents: 20_000n, // 200.00
    revenueCents: 100_000n, // 1000.00
    costCents: 40_000n, // 400.00
    deliveredOrders: 5,
  }

  it("computes capacity, profit and margin without float on money", () => {
    const report = simulate(data, { failureRate: 0, periodMonths: 1 })
    expect(report.capacity.totalMonthlyLimit).toBe("600.00")
    expect(report.capacity.used).toBe("200.00")
    expect(report.capacity.available).toBe("400.00")
    expect(report.finance.grossProfit).toBe("600.00")
    expect(report.finance.margin).toBeCloseTo(0.6, 5)
  })

  it("applies a failure-rate scenario and multi-month projection", () => {
    const report = simulate(data, { failureRate: 0.1, periodMonths: 3 })
    expect(report.scenario.effectiveRevenue).toBe("900.00")
    expect(report.scenario.profit).toBe("500.00")
    expect(report.projection.revenue).toBe("2700.00")
    expect(report.projection.profit).toBe("1500.00")
  })

  it("never divides by zero", () => {
    const empty: SimulatorData = {
      activeAccounts: 0,
      totalMonthlyLimitCents: 0n,
      confirmedBalanceCents: 0n,
      spentCents: 0n,
      revenueCents: 0n,
      costCents: 0n,
      deliveredOrders: 0,
    }
    const report = simulate(empty)
    expect(report.capacity.utilization).toBe(0)
    expect(report.finance.margin).toBe(0)
    expect(report.capacity.available).toBe("0.00")
  })
})

describe("log sanitization", () => {
  it("redacts sensitive keys and connection strings", () => {
    const clean = sanitizeLogValue({
      status: "ok",
      password: "hunter2",
      token: "abc",
      sessionId: "s",
      databaseUrl: "postgres://x",
      note: "connect postgres://user:pass@host:5433/db now",
    }) as Record<string, unknown>
    expect(clean.status).toBe("ok")
    expect(clean.password).toBe("[redacted]")
    expect(clean.token).toBe("[redacted]")
    expect(clean.sessionId).toBe("[redacted]")
    expect(clean.databaseUrl).toBe("[redacted]")
    expect(clean.note).toBe("connect [redacted-connection] now")
  })

  it("produces safe error messages without stack traces", () => {
    expect(safeErrorMessage(new Error("boom"))).toBe("boom")
    expect(safeErrorMessage(new Error("fail postgres://u:p@h/db"))).toBe("fail [redacted-connection]")
    expect(safeErrorMessage(123)).toBe("Erro interno.")
    const withStack = new Error("visible message")
    expect(safeErrorMessage(withStack)).not.toContain("at ")
  })
})
