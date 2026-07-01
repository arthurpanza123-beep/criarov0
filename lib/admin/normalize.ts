export function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase()
  return trimmed || null
}

export function normalizeRequiredEmail(value: string) {
  const email = normalizeEmail(value)
  if (!email) throw new Error("E-mail inválido.")
  return email
}

export function normalizePhone(value: string | null | undefined) {
  const trimmed = value?.replace(/[^\d+]/g, "").trim()
  return trimmed || null
}

export function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim()
  return text || null
}

export function requiredText(value: FormDataEntryValue | null, label: string) {
  const text = optionalText(value)
  if (!text) throw new Error(`${label} é obrigatório.`)
  return text
}

export function optionalUrl(value: FormDataEntryValue | null) {
  const text = optionalText(value)
  if (!text) return null
  const url = new URL(text)
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL inválida.")
  }
  return url.toString()
}

export function optionalDecimal(value: FormDataEntryValue | null, fallback = "0") {
  const text = optionalText(value)
  return text ?? fallback
}

export function optionalDate(value: FormDataEntryValue | null) {
  const text = optionalText(value)
  if (!text) return null
  const date = new Date(text)
  if (!Number.isFinite(date.getTime())) throw new Error("Data inválida.")
  return date
}
