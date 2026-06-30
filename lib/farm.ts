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

// Sequência realista do fluxo de uma conta.
// `weight` controla a duração relativa de cada etapa.
export const FARM_STEPS = [
  { key: "open", label: "Abrindo link de convite", weight: 4 },
  { key: "email", label: "Gerando e-mail temporário", weight: 4 },
  { key: "register", label: "Inserindo e-mail no cadastro", weight: 3 },
  { key: "auth", label: "Autenticando via API", weight: 5 },
  { key: "code", label: "Aguardando código de verificação", weight: 9 },
  { key: "fill", label: "Inserindo código de verificação", weight: 3 },
  { key: "confirm", label: "Confirmando convite", weight: 4 },
  { key: "reward", label: "Recompensa confirmada", weight: 2 },
] as const

export const STEP_COUNT = FARM_STEPS.length

// Duração total (ms) por conta: entre 25s e 40s
export const ACCOUNT_MIN_MS = 25_000
export const ACCOUNT_MAX_MS = 40_000
export function randomAccountDuration() {
  return ACCOUNT_MIN_MS + Math.random() * (ACCOUNT_MAX_MS - ACCOUNT_MIN_MS)
}

const TOTAL_WEIGHT = FARM_STEPS.reduce((s, st) => s + st.weight, 0)

// Mapeia o progresso (0-100) de uma conta para a etapa atual.
export function getFarmStep(progress: number): {
  index: number
  label: string
  total: number
  stepProgress: number // 0-1 dentro da etapa atual
} {
  const p = Math.max(0, Math.min(100, progress))
  let acc = 0
  for (let i = 0; i < FARM_STEPS.length; i++) {
    const start = (acc / TOTAL_WEIGHT) * 100
    acc += FARM_STEPS[i].weight
    const end = (acc / TOTAL_WEIGHT) * 100
    if (p < end || i === FARM_STEPS.length - 1) {
      const span = end - start
      const frac = span > 0 ? (p - start) / span : 1
      return {
        index: i,
        label: FARM_STEPS[i].label,
        total: FARM_STEPS.length,
        stepProgress: Math.max(0, Math.min(1, frac)),
      }
    }
  }
  return { index: STEP_COUNT - 1, label: FARM_STEPS[STEP_COUNT - 1].label, total: STEP_COUNT, stepProgress: 1 }
}

export function maskEmail(email: string) {
  const [user, domain] = email.split("@")
  if (!user || !domain) return email
  const visible = user.slice(0, 3)
  return `${visible}${"•".repeat(Math.max(2, user.length - 3))}@${domain}`
}
