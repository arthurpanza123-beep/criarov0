import { z } from "zod"

const decimalSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const normalized = typeof value === "number" ? String(value) : value.trim()
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    ctx.addIssue({ code: "custom", message: "Valor monetário inválido." })
    return z.NEVER
  }
  return normalized
})

export function decimalToCents(value: string | number | null | undefined) {
  if (value == null) return 0n
  const decimal = decimalSchema.parse(value)
  const negative = decimal.startsWith("-")
  const [wholeRaw, fractionRaw = ""] = decimal.replace("-", "").split(".")
  const whole = BigInt(wholeRaw || "0") * 100n
  const fraction = BigInt((fractionRaw + "00").slice(0, 2))
  const cents = whole + fraction
  return negative ? -cents : cents
}

export function centsToDecimal(cents: bigint) {
  const negative = cents < 0n
  const absolute = negative ? -cents : cents
  const whole = absolute / 100n
  const fraction = absolute % 100n
  return `${negative ? "-" : ""}${whole}.${fraction.toString().padStart(2, "0")}`
}

export function addDecimals(values: Array<string | number | null | undefined>) {
  return centsToDecimal(values.reduce((total, value) => total + decimalToCents(value), 0n))
}

export function subtractDecimals(left: string | number, right: string | number) {
  return centsToDecimal(decimalToCents(left) - decimalToCents(right))
}

export function toNumber(value: string | number | null | undefined) {
  return Number(centsToDecimal(decimalToCents(value)))
}

export function formatMoney(value: string | number | null | undefined, currency = "USD") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency.length === 3 ? currency : "USD",
  }).format(toNumber(value))
}

export function assertNonNegativeDecimal(value: string | number, label = "Valor") {
  if (decimalToCents(value) < 0n) {
    throw new Error(`${label} não pode ser negativo.`)
  }
}

export function assertFiniteDecimal(value: string | number, label = "Valor") {
  try {
    decimalToCents(value)
  } catch {
    throw new Error(`${label} inválido.`)
  }
}
