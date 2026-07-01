export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-"
  const date = typeof value === "string" ? new Date(value) : value
  if (!Number.isFinite(date.getTime())) return "-"
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

export function safeText(value: string | null | undefined) {
  return value?.trim() || "-"
}

export function maskEmail(email: string | null | undefined) {
  if (!email) return "-"
  const [local = "", domain = ""] = email.split("@")
  return `${local.slice(0, 2)}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`
}
