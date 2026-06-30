"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import {
  Play,
  Pause,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
  MailCheck,
  DollarSign,
  Target,
  Infinity as InfinityIcon,
  Plus,
  CheckCircle2,
  Loader2,
  Inbox,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/animated-number"
import { FarmCore } from "@/components/farm-core"
import { AddAccountsModal } from "@/components/add-accounts-modal"
import {
  type Account,
  DEFAULT_ACCOUNTS_RAW,
  parseAccounts,
  maskEmail,
} from "@/lib/farm"

type FarmState = "idle" | "running" | "paused" | "done"
type FarmMode = "all" | "goal"
type FeedItem = { id: string; email: string }

const PER_ACCOUNT = 5

export function FarmConsole() {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [rawAccounts, setRawAccounts] = useState(DEFAULT_ACCOUNTS_RAW)
  const [accounts, setAccounts] = useState<Account[]>(() =>
    parseAccounts(DEFAULT_ACCOUNTS_RAW),
  )
  const [state, setState] = useState<FarmState>("idle")
  const [usedCount, setUsedCount] = useState(0)
  const [activeEmail, setActiveEmail] = useState<string | null>(null)
  const [curProgress, setCurProgress] = useState(0)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  // Meta de ganhos (valor por conta é fixo: $5)
  const [mode, setMode] = useState<FarmMode>("all")
  const [goalUsd, setGoalUsd] = useState(355)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const accountsRef = useRef(accounts)
  const progressRef = useRef(0)
  useEffect(() => {
    accountsRef.current = accounts
  }, [accounts])

  const available = accounts.length
  const earnings = usedCount * PER_ACCOUNT

  // Meta: arredonda SEMPRE para cima o nº de contas necessárias
  const neededForGoal = Math.ceil(goalUsd / PER_ACCOUNT)

  const overall =
    mode === "goal"
      ? Math.min(100, Math.round((usedCount / Math.max(1, neededForGoal)) * 100))
      : Math.round((usedCount / Math.max(1, usedCount + available)) * 100)

  // Loop de farm — consome 1 conta por vez e a REMOVE da lista ao concluir.
  useEffect(() => {
    if (state !== "running") {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    timerRef.current = setInterval(() => {
      const list = accountsRef.current
      if (list.length === 0) return

      const current = list[0]
      setActiveEmail(current.email)
      const step = 6 + Math.random() * 14
      progressRef.current = Math.min(100, progressRef.current + step)

      if (progressRef.current >= 100) {
        progressRef.current = 0
        setCurProgress(0)
        setAccounts((prev) => prev.slice(1))
        setUsedCount((u) => u + 1)
        // a conta farmada aparece no feed, de pouco em pouco
        setFeed((prev) => [
          { id: `${current.email}-${Date.now()}`, email: current.email },
          ...prev,
        ])
      } else {
        setCurProgress(progressRef.current)
      }
    }, 220)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state])

  // Detecta conclusão (lista vazia ou meta atingida)
  useEffect(() => {
    if (state !== "running") return
    if (available === 0 || (mode === "goal" && usedCount >= neededForGoal)) {
      setState("done")
      setActiveEmail(null)
    }
  }, [available, usedCount, mode, neededForGoal, state])

  const coreProgress = state === "done" ? 100 : curProgress
  const locked = state === "running" || state === "paused"

  function start() {
    if (available === 0) return
    setState("running")
  }
  function pause() {
    setState("paused")
  }
  function reset() {
    if (timerRef.current) clearInterval(timerRef.current)
    progressRef.current = 0
    setCurProgress(0)
    setUsedCount(0)
    setActiveEmail(null)
    setFeed([])
    setAccounts(parseAccounts(rawAccounts))
    setState("idle")
  }

  function loadAccounts(raw: string) {
    setRawAccounts(raw)
    setAccounts(parseAccounts(raw))
    setUsedCount(0)
    setFeed([])
    setActiveEmail(null)
    progressRef.current = 0
    setCurProgress(0)
    setState("idle")
    setModalOpen(false)
  }

  return (
    <section className="relative mx-auto max-w-2xl px-4 py-8 md:py-12">
      {/* Cabeçalho */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 ring-glow">
          <Image
            src="/credit-farm-mascot.png"
            alt="Credit Farm"
            width={96}
            height={96}
            className="h-14 w-14 object-contain"
            priority
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Painel de automação
          </div>
          <h1 className="text-balance text-2xl font-bold tracking-tight md:text-3xl">
            Credit <span className="text-primary text-glow">Farm</span>
          </h1>
        </div>
      </div>

      {/* Núcleo + Ganhos */}
      <div className="relative mb-6 flex flex-col items-center overflow-hidden rounded-2xl border border-primary/30 bg-card/50 p-8 backdrop-blur-sm ring-glow">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
        {state === "running" && (
          <div className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        )}

        <div className="relative">
          <FarmCore state={state} progress={coreProgress} />
        </div>

        {/* Ganhos */}
        <div className="relative mt-6 text-center">
          <span className="flex items-center justify-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <DollarSign className="size-3.5 text-primary" />
            Ganhos acumulados · $5 por conta
          </span>
          <AnimatedNumber
            value={earnings}
            prefix="$"
            decimals={0}
            className="mt-1 block font-mono text-5xl font-bold tabular-nums text-primary text-glow"
          />
          <AnimatePresence mode="wait">
            <motion.p
              key={state}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mt-2 text-sm text-muted-foreground"
            >
              {state === "idle" && `${available} contas prontas para farmar`}
              {state === "running" && activeEmail && (
                <span className="font-mono text-primary">
                  Farmando {maskEmail(activeEmail)}
                </span>
              )}
              {state === "paused" && "Farm pausado — clique em retomar"}
              {state === "done" && (
                <span className="font-medium text-primary">
                  {usedCount} contas farmadas · +${earnings.toLocaleString("pt-BR")}
                </span>
              )}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Barra de progresso */}
        <div className="relative mt-5 w-full max-w-sm">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {mode === "goal"
                ? `${usedCount}/${neededForGoal} contas · meta $${goalUsd.toLocaleString("pt-BR")}`
                : `${usedCount} farmadas`}
            </span>
            <span className="font-mono font-semibold text-primary">{overall}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              animate={{ width: `${overall}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              style={{ boxShadow: "0 0 12px var(--primary)" }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard icon={Mail} label="Disponíveis" value={available} tone="primary" />
        <StatCard icon={MailCheck} label="Usadas" value={usedCount} tone="muted" />
      </div>

      {/* Controles */}
      <div className="mb-6 flex flex-wrap gap-3">
        {state !== "running" ? (
          <Button
            onClick={start}
            size="lg"
            className="group flex-1 ring-glow"
            disabled={available === 0}
          >
            <Play className="transition-transform group-hover:scale-110" />
            {state === "paused" ? "Retomar farm" : "Iniciar farm"}
          </Button>
        ) : (
          <Button onClick={pause} size="lg" variant="secondary" className="flex-1">
            <Pause />
            Pausar
          </Button>
        )}
        <Button onClick={reset} size="lg" variant="outline" disabled={state === "idle"}>
          <RotateCcw />
          Resetar
        </Button>
      </div>

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
        </div>

        {/* Meta de ganhos */}
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
          <label className="mb-4 flex items-center gap-2 text-sm font-medium">
            <Target className="size-4 text-primary" />
            Meta de ganhos
          </label>

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

          <AnimatePresence initial={false}>
            {mode === "goal" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <span className="mb-1.5 block text-xs text-muted-foreground">
                  Quanto você quer ganhar (USD)
                </span>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary" />
                  <input
                    type="number"
                    min={PER_ACCOUNT}
                    step={PER_ACCOUNT}
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
                      ${(neededForGoal * PER_ACCOUNT).toLocaleString("pt-BR")}
                    </span>
                    {neededForGoal > available + usedCount && (
                      <span className="text-destructive">
                        {" "}
                        — faltam {neededForGoal - (available + usedCount)} contas
                      </span>
                    )}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pool de contas + feed ao vivo */}
        <div className="rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Mail className="size-4 text-primary" />
              Contas
            </label>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setModalOpen(true)}
              disabled={locked}
            >
              <Plus className="size-4" />
              {available > 0 ? "Gerenciar" : "Adicionar"}
            </Button>
          </div>

          {/* Resumo do pool */}
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <Inbox className="size-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">
                <span className="font-mono text-primary">{available}</span> contas no pool
              </p>
              <p className="text-xs text-muted-foreground">
                As farmadas saem do pool e aparecem abaixo
              </p>
            </div>
          </div>

          {/* Feed ao vivo — aparece de pouco em pouco */}
          <div className="relative max-h-72 overflow-y-auto rounded-xl border border-border/60 bg-background/40 p-2">
            {/* Conta em processamento */}
            <AnimatePresence>
              {state === "running" && activeEmail && (
                <motion.div
                  key={`active-${activeEmail}`}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mb-1.5 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2.5"
                >
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                  <span className="flex-1 truncate font-mono text-xs text-primary">
                    {maskEmail(activeEmail)}
                  </span>
                  <span className="font-mono text-[11px] text-primary">
                    {Math.round(curProgress)}%
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contas já farmadas */}
            {feed.length === 0 && state !== "running" ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                <MailCheck className="size-7 opacity-50" />
                <p className="text-sm">As contas farmadas aparecerão aqui</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {feed.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                  >
                    <CheckCircle2 className="size-4 shrink-0 text-primary" />
                    <span className="flex-1 truncate font-mono text-xs text-foreground/80">
                      {maskEmail(item.email)}
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-primary">
                      +$5
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      <AddAccountsModal
        open={modalOpen}
        initialValue={rawAccounts}
        onClose={() => setModalOpen(false)}
        onConfirm={loadAccounts}
      />
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
