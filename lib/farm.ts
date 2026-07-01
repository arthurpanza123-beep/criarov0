export type AccountStatus = "available" | "queued" | "review" | "archived"

export type Account = {
  id: string
  label: string
  email: string
  provider: string
  status: AccountStatus
  creditBalance: number
  monthlyCreditLimit: number
  progress: number
}

export const DEFAULT_ACCOUNTS_RAW = `Conta Norte, norte.ops@example.com, Plataforma A, 200
Conta Sul, sul.ops@example.com, Plataforma B, 200
Conta Leste, leste.ops@example.com, Plataforma A, 150
Conta Oeste, oeste.ops@example.com, Plataforma C, 200
Conta Backup, backup.ops@example.com, Plataforma B, 100`

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
      // Formato demo seguro: "rótulo, e-mail, provedor, limite mensal".
      const match = line.split(/\s*,\s*/)
      const label = (match[0] || "").trim()
      const email = (match[1] || "").trim()
      const provider = (match[2] || "Interno").trim()
      const monthlyCreditLimit = Number(match[3] || 200)
      return {
        id: uid(),
        label,
        email,
        provider,
        status: "available" as AccountStatus,
        creditBalance: Math.max(0, Math.min(monthlyCreditLimit, monthlyCreditLimit * 0.75)),
        monthlyCreditLimit,
        progress: 0,
      }
    })
    .filter((a) => a.label.length > 0 && a.email.includes("@"))
}

export function serializeAccounts(accounts: Account[]): string {
  return accounts
    .map((a) => `${a.label}, ${a.email}, ${a.provider}, ${a.monthlyCreditLimit}`)
    .join("\n")
}

export const MAX_INVITES = 40
// Crédito estimado por atividade administrativa e teto mensal por conta.
export const PER_INVITE = 5
export const MAX_PER_ACCOUNT = MAX_INVITES * PER_INVITE // $200

// Sequência demonstrativa de uma fila operacional interna.
// `weight` controla a duração relativa de cada etapa.
export const FARM_STEPS = [
  { key: "select", label: "Selecionando conta gerenciada", weight: 4 },
  { key: "limit", label: "Validando limite mensal", weight: 4 },
  { key: "campaign", label: "Associando campanha", weight: 3 },
  { key: "queue", label: "Enfileirando atividade", weight: 5 },
  { key: "review", label: "Aguardando revisão operacional", weight: 9 },
  { key: "ledger", label: "Registrando saldo estimado", weight: 3 },
  { key: "panel", label: "Atualizando painel", weight: 4 },
  { key: "done", label: "Atividade concluída", weight: 2 },
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
