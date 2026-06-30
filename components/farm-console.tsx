"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import {
  Play,
  Pause,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  Mail,
  MailCheck,
  Clock,
  DollarSign,
  Target,
  Infinity as InfinityIcon,
  Coins,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/animated-number"
import { FarmCore } from "@/components/farm-core"
import {
  type Account,
  DEFAULT_ACCOUNTS_RAW,
  parseAccounts,
  maskEmail,
} from "@/lib/farm"

type FarmState = "idle" | "running" | "paused" | "done"
type FarmMode = "all" | "goal"

export function FarmConsole() {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [rawAccounts, setRawAccounts] = useState(DEFAULT_ACCOUNTS_RAW)
  const [accounts, setAccounts] = useState<Account[]>(() =>
    parseAccounts(DEFAULT_ACCOUNTS_RAW),
  )
  const [state, setState] = useState<FarmState>("idle")
  const [activeId, setActiveId] = useState<string | null>(null)

  // Configuração de ganhos
  const [perAccount, setPerAccount] = useState(5)
  const [mode, setMode] = useState<FarmMode>("all")
  const [goalUsd, setGoalUsd] = useState(357)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const syncAccounts = useCallback(() => {
    if (state === "idle" || state === "done") {
      setAccounts(parseAccounts(rawAccounts))
    }
  }, [rawAccounts, state])

  const total = accounts.length
  const doneCount = accounts.filter((a) => a.status === "done").length
  const available = total - doneCount

  // Meta: arredonda SEMPRE para cima o nº de contas necessárias
  const neededForGoal = Math.ceil(goalUsd / Math.max(1, perAccount))
  const targetCount = mode === "goal" ? Math.min(total, neededForGoal) : total
  const overall = targetCount === 0 ? 0 : Math.round((doneCount / targetCount) * 100)

  const earnings = doneCount * perAccount
  const projected = targetCount * perAccount

  // ref para o loop ler o alvo atualizado
  const targetRef = useRef(targetCount)
  targetRef.current = targetCount

  // Loop de farm
  useEffect(() => {
    if (state !== "running") {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      setAccounts((prev) => {
        const next = [...prev]
        const completed = next.filter((a) => a.status === "done").length
        if (completed >= targetRef.current) return next

        let idx = next.findIndex((a) => a.status === "running")
        if (idx === -1) {
          idx = next.findIndex((a) => a.status === "idle")
          if (idx === -1) return next
          next[idx] = { ...next[idx], status: "running" }
          setActiveId(next[idx].id)
        }
        const cur = next[idx]
        const step = 6 + Math.random() * 14
        const progress = Math.min(100, cur.progress + step)
        next[idx] = {
          ...cur,
          progress,
          status: progress >= 100 ? "done" : "running",
        }
        return next
      })
    }, 240)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state])

  // Detecta conclusão (total ou meta)
  useEffect(() => {
    if (state === "running" && targetCount > 0 && doneCount >= targetCount) {
      setState("done")
      setActiveId(null)
    }
  }, [doneCount, targetCount, state])

  const activeProgress = (() => {
    if (state === "done") return 100
    const active = accounts.find((a) => a.id === activeId)
    const base = (doneCount / Math.max(1, targetCount)) * 100
    const partial = active
      ? (active.progress / 100) * (100 / Math.max(1, targetCount))
      : 0
    return Math.min(100, base + partial)
  })()

  const locked = state === "running" || state === "paused"

  function start() {
    if (total === 0) return
    if (state === "done") reset(true)
    setState("running")
  }
  function pause() {
    setState("paused")
  }
  function reset(silent = false) {
    if (timerRef.current) clearInterval(timerRef.current)
    setAccounts(parseAccounts(rawAccounts))
    setActiveId(null)
    if (!silent) setState("idle")
  }

  return (
    <section id="console" className="relative mx-auto max-w-6xl scroll-mt-20 px-4 py-8 md:py-10">
      <div className="mb-8 flex flex-col gap-1 border-b border-border/60 pb-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          Painel de automação
        </div>
        <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">
          Console de <span className="text-primary">Farm</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure seus ganhos, defina uma meta e controle a automação ao vivo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Coluna esquerda: configuração */}
        <div className="flex flex-col gap-6">
          {/* API Key */}
          <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium">
              <KeyRound className="size-4 text-primary" />
              API NotLetters
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="nl_live_••••••••••••••••"
                  className="w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 pr-10 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showKey ? "Esconder chave" : "Mostrar chave"}
                >
                  {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <span
                className={`flex size-2.5 shrink-0 rounded-full transition-colors ${
                  apiKey ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted-foreground/40"
                }`}
                aria-hidden
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {apiKey ? "Chave detectada — pronto para autenticar." : "Insira a chave da API para autorizar o farm."}
            </p>
          </div>

          {/* Configuração de ganhos */}
          <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
            <label className="mb-4 flex items-center gap-2 text-sm font-medium">
              <Coins className="size-4 text-primary" />
              Configuração de ganhos
            </label>

            {/* Valor por conta */}
            <div className="mb-5">
              <span className="mb-1.5 block text-xs text-muted-foreground">
                Valor por conta farmada (USD)
              </span>
              <div className="relative">
                <DollarSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={perAccount}
                  disabled={locked}
                  onChange={(e) => setPerAccount(Math.max(1, Number(e.target.value) || 0))}
                  className="w-full rounded-lg border border-input bg-background/60 py-2.5 pl-9 pr-3 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                />
              </div>
            </div>

            {/* Modo */}
            <span className="mb-1.5 block text-xs text-muted-foreground">Modo do farm</span>
            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-border/60 bg-background/40 p-1">
              <ModeButton
                active={mode === "all"}
                disabled={locked}
                onClick={() => setMode("all")}
                icon={InfinityIcon}
                label="Farm completo"
              />
              <ModeButton
                active={mode === "goal"}
                disabled={locked}
                onClick={() => setMode("goal")}
                icon={Target}
                label="Por meta ($)"
              />
            </div>

            {/* Meta */}
            <AnimatePresence initial={false}>
              {mode === "goal" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <span className="mb-1.5 block text-xs text-muted-foreground">
                    Meta em dólares
                  </span>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                    <input
                      type="number"
                      min={perAccount}
                      step={perAccount}
                      value={goalUsd}
                      disabled={locked}
                      onChange={(e) => setGoalUsd(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full rounded-lg border border-input bg-background/60 py-2.5 pl-9 pr-3 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
                    <Target className="size-3.5 shrink-0 text-primary" />
                    <span className="text-muted-foreground">
                      Arredondando para cima:{" "}
                      <span className="font-mono font-semibold text-primary">
                        {neededForGoal} contas
                      </span>{" "}
                      ={" "}
                      <span className="font-mono font-semibold text-primary">
                        ${(neededForGoal * perAccount).toLocaleString("pt-BR")}
                      </span>
                      {neededForGoal > total && (
                        <span className="text-destructive">
                          {" "}
                          — faltam {neededForGoal - total} contas na lista
                        </span>
                      )}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Contas */}
          <div id="contas" className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium">
                <Mail className="size-4 text-primary" />
                Contas (email &gt; senha)
              </label>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                {parseAccounts(rawAccounts).length} válidas
              </span>
            </div>
            <textarea
              value={rawAccounts}
              onChange={(e) => setRawAccounts(e.target.value)}
              onBlur={syncAccounts}
              disabled={locked}
              rows={8}
              spellCheck={false}
              className="w-full resize-none rounded-lg border border-input bg-background/60 p-3 font-mono text-xs leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
              placeholder="email@dominio.com > senha"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Formatos aceitos: <code className="text-foreground">{"email > senha"}</code>,{" "}
              <code className="text-foreground">email:senha</code>
            </p>
          </div>

          {/* Controles */}
          <div className="flex flex-wrap gap-3">
            {state !== "running" ? (
              <Button onClick={start} size="lg" className="group flex-1 ring-glow" disabled={total === 0}>
                <Play className="transition-transform group-hover:scale-110" />
                {state === "paused" ? "Retomar farm" : "Iniciar farm"}
              </Button>
            ) : (
              <Button onClick={pause} size="lg" variant="secondary" className="flex-1">
                <Pause />
                Pausar
              </Button>
            )}
            <Button onClick={() => reset()} size="lg" variant="outline" disabled={state === "idle"}>
              <RotateCcw />
              Resetar
            </Button>
          </div>
        </div>

        {/* Coluna direita: monitor */}
        <div className="flex flex-col gap-6">
          {/* Banner de ganhos */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card/50 p-6 backdrop-blur-sm ring-glow">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-20" />
            {state === "running" && (
              <div className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
            )}
            <div className="relative flex items-center justify-between">
              <div>
                <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                  <DollarSign className="size-3.5 text-primary" />
                  Ganhos acumulados
                </span>
                <AnimatedNumber
                  value={earnings}
                  prefix="$"
                  decimals={0}
                  className="mt-1 block font-mono text-4xl font-bold tabular-nums text-primary text-glow md:text-5xl"
                />
              </div>
              <div className="text-right">
                <span className="block text-xs text-muted-foreground">
                  {mode === "goal" ? "Meta" : "Projeção total"}
                </span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  ${ (mode === "goal" ? neededForGoal * perAccount : projected).toLocaleString("pt-BR") }
                </span>
              </div>
            </div>

            {/* progresso da meta */}
            <div className="relative mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {doneCount}/{targetCount} contas
                </span>
                <span className="font-mono font-semibold text-primary">{overall}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${overall}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  style={{ boxShadow: "0 0 12px var(--primary)" }}
                />
              </div>
            </div>
          </div>

          {/* Núcleo de farm */}
          <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-8 backdrop-blur-sm">
            <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
            <div className="relative">
              <FarmCore state={state} progress={activeProgress} />
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={state}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="relative mt-4 text-center text-sm text-muted-foreground"
              >
                {state === "idle" && "Pronto para iniciar a automação"}
                {state === "running" && activeId && (
                  <span className="font-mono text-primary">
                    Processando {maskEmail(accounts.find((a) => a.id === activeId)?.email ?? "")}
                  </span>
                )}
                {state === "paused" && "Farm pausado — clique em retomar"}
                {state === "done" && (
                  <span className="font-medium text-primary">
                    Meta atingida! +${earnings.toLocaleString("pt-BR")} farmados
                  </span>
                )}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Stats de e-mails */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon={Mail} label="Disponíveis" value={available} tone="primary" />
            <StatCard icon={MailCheck} label="Usados" value={doneCount} tone="muted" />
            <StatCard icon={Clock} label="Total" value={total} tone="muted" />
          </div>
        </div>
      </div>

      {/* Lista de contas */}
      <AccountList accounts={accounts} activeId={activeId} targetCount={targetCount} />
    </section>
  )
}

function ModeButton({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: typeof Target
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="mode-pill"
          className="absolute inset-0 rounded-lg bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </span>
    </button>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Mail
  label: string
  value: number
  tone: "primary" | "muted"
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4 text-center backdrop-blur-sm">
      <Icon
        className={`mx-auto mb-1.5 size-4 ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`}
      />
      <AnimatedNumber
        value={value}
        className={`block font-mono text-2xl font-bold tabular-nums ${
          tone === "primary" ? "text-primary text-glow" : "text-foreground"
        }`}
      />
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

function AccountList({
  accounts,
  activeId,
  targetCount,
}: {
  accounts: Account[]
  activeId: string | null
  targetCount: number
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
        <h3 className="text-sm font-semibold">Fila de contas</h3>
        <span className="font-mono text-xs text-muted-foreground">
          alvo: {targetCount} de {accounts.length}
        </span>
      </div>
      <ul className="divide-y divide-border/40">
        <AnimatePresence initial={false}>
          {accounts.map((a, i) => {
            const beyondTarget = i >= targetCount
            return (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: beyondTarget ? 0.4 : 1 }}
                className={`relative flex items-center gap-3 px-5 py-3 transition-colors ${
                  a.id === activeId ? "bg-primary/5" : ""
                }`}
              >
                {a.id === activeId && a.status === "running" && (
                  <span className="absolute inset-y-0 left-0 w-0.5 bg-primary" />
                )}
                <StatusDot status={a.status} active={a.id === activeId} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-mono text-sm">{maskEmail(a.email)}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {a.status === "done" ? "100%" : `${Math.round(a.progress)}%`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full rounded-full ${a.status === "done" ? "bg-primary" : "bg-primary/70"}`}
                      animate={{ width: `${a.status === "done" ? 100 : a.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function StatusDot({
  status,
  active,
}: {
  status: Account["status"]
  active: boolean
}) {
  if (status === "done") {
    return (
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
      >
        <CheckCircle2 className="size-4" />
      </motion.span>
    )
  }
  if (status === "running" || active) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center text-primary">
        <Loader2 className="size-4 animate-spin" />
      </span>
    )
  }
  return <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" />
}
