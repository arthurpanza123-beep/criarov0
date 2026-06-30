export type AccountStatus = "idle" | "running" | "done" | "error"

export type Account = {
  id: string
  email: string
  password: string
  status: AccountStatus
  progress: number
}

export const DEFAULT_ACCOUNTS_RAW = `joanny827016@z-auth.site > R8ZL5q1qBJ9r
cham69@z-auth.site > AIXuyn3Oj@v*
jones875382@z-auth.site > vL(2EBSWhTMD
euclid1977@z-auth.site > MjQTljFDwTxO
greagoir64@z-auth.site > QPDR4Yy85hbM
victor82000@z-auth.site > DCD4Zl2FjbNP
crewe469006@z-auth.site > GOzlMaX8vczT
eibhir_4691@z-auth.site > UkkvC9H35YEG
wieland_0747@z-auth.site > u7Hr6Vkq*O*f
kare_6817@z-auth.site > RKgPMl1InQP1`

let counter = 0
function uid() {
  counter += 1
  return `acc_${Date.now().toString(36)}_${counter}`
}

export function parseAccounts(raw: string): Account[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Aceita formatos "email > senha", "email:senha", "email | senha"
      const match = line.split(/\s*(?:>|:|\|)\s*/)
      const email = (match[0] || "").trim()
      const password = (match[1] || "").trim()
      return {
        id: uid(),
        email,
        password,
        status: "idle" as AccountStatus,
        progress: 0,
      }
    })
    .filter((a) => a.email.includes("@") && a.password.length > 0)
}

export function serializeAccounts(accounts: Account[]): string {
  return accounts.map((a) => `${a.email} > ${a.password}`).join("\n")
}

export const MAX_INVITES = 40
// Ganho por email/convite e teto por conta
export const PER_INVITE = 5
export const MAX_PER_ACCOUNT = MAX_INVITES * PER_INVITE // $200

export const FARM_STEPS = [
  "Autenticando conta",
  "Aplicando link de convite",
  "Convidando usuários",
  "Confirmando recompensa",
] as const

// Mapeia o progresso (0-100) de uma conta para a etapa atual + nº de convites
export function getFarmStep(progress: number): {
  index: number
  label: string
  invites: number
} {
  let index: number
  if (progress < 20) index = 0
  else if (progress < 45) index = 1
  else if (progress < 90) index = 2
  else index = 3

  // durante "Convidando usuários" (45-90) o contador sobe até 40
  let invites = 0
  if (progress >= 45) {
    const ratio = Math.min(1, (progress - 45) / (90 - 45))
    invites = Math.min(MAX_INVITES, Math.round(ratio * MAX_INVITES))
  }
  if (progress >= 90) invites = MAX_INVITES

  return { index, label: FARM_STEPS[index], invites }
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@")
  if (!user || !domain) return email
  const visible = user.slice(0, 3)
  return `${visible}${"•".repeat(Math.max(2, user.length - 3))}@${domain}`
}
