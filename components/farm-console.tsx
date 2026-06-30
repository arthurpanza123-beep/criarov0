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
  Activity,
  Users,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AnimatedNumber } from "@/components/animated-number"
import { FarmCore } from "@/components/farm-core"
import { AddAccountsModal } from "@/components/add-accounts-modal"
import { StartFarmDialog, type StartConfig } from "@/components/start-farm-dialog"
import {
  type Account,
  DEFAULT_ACCOUNTS_RAW,
  parseAccounts,
  maskEmail,
  getFarmStep,
  FARM_STEPS,
  MAX_INVITES,
} from "@/lib/farm"

type FarmState = "idle" | "running" | "paused" | "done"
type FarmMode = "all" | "goal"
type FeedItem = { id: string; email: string }
type Tab = "farm" | "settings"

const PER_ACCOUNT = 5

export function FarmConsole() {
  const [tab, setTab] = useState<Tab>("farm")
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
  const [startOpen, setStartOpen] = useState(false)
  const [config, setConfig] = useState<StartConfig | null>(null)

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
  const activeStep = getFarmStep(curProgress)

  function start() {
    if (available === 0) return
    if (state === "paused") {
      setState("running")
      return
    }
    setStartOpen(true)
  }
  function confirmStart(cfg: StartConfig) {
    setConfig(cfg)
    setStartOpen(false)
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

  function addAccounts(raw: string) {
    const incoming = parseAccounts(raw)
    if (incoming.length === 0) return
    setRawAccounts((prev) => (prev.trim() ? `${prev.trim()}\n${raw.trim()}` : raw.trim()))
    setAccounts((prev) => [...prev, ...incoming])
    setModalOpen(false)
  }

  return (
    <section className="mx-auto flex h-dvh max-w-6xl flex-col gap-3 overflow-hidden px-4 py-4 md:px-6 md:py-5">
      {/* Cabeçalho */}
      <header className="flex shrink-0 items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-transparent ring-glow">
            <Image
              src="/credit-farm-mascot.png"
              alt="Credit Farm"
              width={96}
              height={96}
              className="h-9 w-9 object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-balance text-xl font-bold leading-none tracking-tight">
              Credit <span className="text-primary text-glow">Farm</span>
            </h1>
            <span className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <span className={`relative flex size-2 ${state === "running" ? "" : "opacity-60"}`}>
                {state === "running" && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                )}
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {state === "running" ? "Worker em execução" : "Painel de automação"}
            </span>
          </div>
        </div>

        {/* Abas + saldo */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-sm">
            <TabButton active={tab === "farm"} onClick={() => setTab("farm")} icon={Activity} label="Farm" />
            <TabButton
              active={tab === "settings"}
              onClick={() => setTab("settings")}
              icon={SettingsIcon}
              label="Config"
            />
          </div>
          <div className="hidden flex-col items-end rounded-xl border border-border/60 bg-card/50 px-3 py-1.5 backdrop-blur-sm sm:flex">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Saldo</span>
            <AnimatedNumber
              value={earnings}
              prefix="$"
              decimals={0}
              className="font-mono text-base font-bold leading-none tabular-nums text-primary"
            />
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {tab === "farm" ? (
          <motion.div
            key="farm"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="grid min-h-0 flex-1 gap-3 overflow-y-auto lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:overflow-hidden"
          >
            {/* Coluna esquerda: núcleo + stats + controles */}
            <div className="flex min-h-0 flex-col gap-3">
              {/* Núcleo + Ganhos */}
              <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border border-primary/30 bg-card/50 p-5 backdrop-blur-sm ring-glow">
                <div className="pointer-events-none absolute inset-0 bg-grid opacity-25" />
                {state === "running" && (
                  <div className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
                )}

                <div className="relative">
                  <FarmCore state={state} progress={coreProgress} size={168} />
                </div>

                <div className="relative mt-3 text-center">
                  <span className="flex items-center justify-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <DollarSign className="size-3 text-primary" />
                    Ganhos · $5 por conta
                  </span>
                  <AnimatedNumber
                    value={earnings}
                    prefix="$"
                    decimals={0}
                    className="mt-0.5 block font-mono text-4xl font-bold tabular-nums text-primary text-glow"
                  />
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={state}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="mt-1 text-xs text-muted-foreground"
                    >
                      {state === "idle" && `${available} contas prontas para farmar`}
                      {state === "running" && activeEmail && (
                        <span className="font-mono text-primary">Farmando {maskEmail(activeEmail)}</span>
                      )}
                      {state === "paused" && "Farm pausado — clique em retomar"}
                      {state === "done" && (
                        <span className="font-medium text-primary">
                          {usedCount} contas · +${earnings.toLocaleString("pt-BR")}
                        </span>
                      )}
                    </motion.p>
                  </AnimatePresence>

                  {/* Barra de progresso */}
                  <div className="mx-auto mt-3 w-full max-w-xs">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">
                        {mode === "goal"
                          ? `${usedCount}/${neededForGoal} · meta $${goalUsd.toLocaleString("pt-BR")}`
                          : `${usedCount} farmadas`}
                      </span>
                      <span className="font-mono font-semibold text-primary">{overall}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${overall}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        style={{ boxShadow: "0 0 12px var(--primary)" }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid shrink-0 grid-cols-2 gap-3">
                <StatCard icon={Mail} label="Disponíveis" value={available} tone="primary" />
                <StatCard icon={MailCheck} label="Usadas" value={usedCount} tone="muted" />
              </div>

              {/* Controles */}
              <div className="flex shrink-0 gap-3">
                {state !== "running" ? (
                  <Button onClick={start} size="lg" className="group flex-1 ring-glow" disabled={available === 0}>
                    <Play className="transition-transform group-hover:scale-110" />
                    {state === "paused" ? "Retomar" : "Iniciar farm"}
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
            </div>

            {/* Coluna direita: atividade ao vivo */}
            <div className="flex min-h-0 flex-col rounded-3xl border border-border/60 bg-card/50 p-4 backdrop-blur-sm">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div className="flex flex-col">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Activity className="size-4 text-primary" />
                    Atividade ao vivo
                  </label>
                  <span className="mt-0.5 text-[11px] text-muted-foreground">
                    {feed.length > 0
                      ? `${feed.length} contas farmadas nesta sessão`
                      : "Processando e concluídas aparecem aqui"}
                  </span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
                  <Plus className="size-4" />
                  Adicionar
                </Button>
              </div>

              <div className="relative min-h-0 flex-1 space-y-1.5 overflow-y-auto rounded-2xl border border-border/60 bg-background/40 p-2">
                {/* Conta em processamento */}
                <AnimatePresence>
                  {state === "running" && activeEmail && (
                    <motion.div
                      key={`active-${activeEmail}`}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="relative overflow-hidden rounded-xl border border-primary/40 bg-primary/10 p-3"
                    >
                      <motion.div
                        className="pointer-events-none absolute inset-y-0 left-0 bg-primary/15"
                        animate={{ width: `${curProgress}%` }}
                        transition={{ duration: 0.2, ease: "linear" }}
                      />
                      <div className="relative flex items-center gap-3">
                        <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                        <span className="flex-1 truncate font-mono text-xs font-medium text-primary">
                          {maskEmail(activeEmail)}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-primary">
                          {Math.round(curProgress)}%
                        </span>
                      </div>

                      <div className="relative mt-2 flex items-center justify-between gap-2">
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={activeStep.label}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-foreground/80"
                          >
                            <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 font-mono text-[9px] text-primary">
                              {activeStep.index + 1}
                            </span>
                            {activeStep.label}
                          </motion.span>
                        </AnimatePresence>
                        {activeStep.index === 2 && (
                          <span className="flex items-center gap-1 font-mono text-[11px] text-primary">
                            <Users className="size-3" />
                            {activeStep.invites}/{MAX_INVITES}
                          </span>
                        )}
                      </div>

                      <div className="relative mt-2 flex gap-1">
                        {FARM_STEPS.map((_, i) => (
                          <span
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= activeStep.index ? "bg-primary" : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {feed.length === 0 && state !== "running" ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                    <div className="flex size-12 items-center justify-center rounded-full border border-border/60 bg-muted/40">
                      <MailCheck className="size-6 opacity-60" />
                    </div>
                    <p className="text-sm">Nada por aqui ainda</p>
                    <p className="text-xs">Inicie o farm para ver as contas processadas</p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {feed.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, x: -12, height: 0 }}
                        animate={{ opacity: 1, x: 0, height: "auto" }}
                        className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/40 px-3 py-2"
                      >
                        <CheckCircle2 className="size-4 shrink-0 text-primary" />
                        <span className="flex-1 truncate font-mono text-xs text-foreground/80">
                          {maskEmail(item.email)}
                        </span>
                        <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">
                          +$5
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto lg:grid-cols-3 lg:overflow-hidden"
          >
            {/* API Key */}
            <div className="flex flex-col rounded-3xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <KeyRound className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">API NotLetters</h2>
                  <p className="text-[11px] text-muted-foreground">Autentica o worker</p>
                </div>
              </div>
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="nl_live_••••••••••••••••"
                  className="w-full rounded-xl border border-input bg-background/60 px-3 py-2.5 pr-10 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
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
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span
                  className={`flex size-2.5 shrink-0 rounded-full transition-colors ${
                    apiKey ? "bg-primary shadow-[0_0_8px_var(--primary)]" : "bg-muted-foreground/40"
                  }`}
                  aria-hidden
                />
                <span className="text-muted-foreground">
                  {apiKey ? "Chave configurada" : "Nenhuma chave configurada"}
                </span>
              </div>
            </div>

            {/* Contas / Emails */}
            <div className="flex flex-col rounded-3xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Mail className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Contas &amp; e-mails</h2>
                  <p className="text-[11px] text-muted-foreground">Pool disponível</p>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col">
                  <AnimatedNumber
                    value={available}
                    className="font-mono text-3xl font-bold leading-none tabular-nums text-primary text-glow"
                  />
                  <span className="mt-1 text-[11px] text-muted-foreground">contas no pool</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  Senhas mascaradas
                </div>
              </div>

              <Button className="mt-4 w-full" variant="secondary" onClick={() => setModalOpen(true)}>
                <Plus className="size-4" />
                Adicionar contas
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Formato: e-mail &gt; senha (uma por linha) ou .txt
              </p>
            </div>

            {/* Meta de ganhos */}
            <div className="flex flex-col rounded-3xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                  <Target className="size-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">Meta de ganhos</h2>
                  <p className="text-[11px] text-muted-foreground">Até onde o farm vai</p>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-background/40 p-1">
                <ModeButton
                  active={mode === "all"}
                  disabled={locked}
                  onClick={() => setMode("all")}
                  icon={InfinityIcon}
                  label="Completo"
                />
                <ModeButton
                  active={mode === "goal"}
                  disabled={locked}
                  onClick={() => setMode("goal")}
                  icon={Target}
                  label="Por meta"
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
                        className="w-full rounded-xl border border-input bg-background/60 py-2.5 pl-9 pr-3 font-mono text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                      />
                    </div>
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
                      <Target className="size-3.5 shrink-0 text-primary" />
                      <span className="text-muted-foreground">
                        Arredondando:{" "}
                        <span className="font-mono font-semibold text-primary">{neededForGoal} contas</span> ={" "}
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
          </motion.div>
        )}
      </AnimatePresence>

      <AddAccountsModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={addAccounts} />

      <StartFarmDialog
        open={startOpen}
        maxTokens={available * MAX_INVITES}
        onClose={() => setStartOpen(false)}
        onConfirm={confirmStart}
      />
    </section>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof Activity
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 rounded-lg bg-primary ring-glow"
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
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/50 p-3 backdrop-blur-sm">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
          tone === "primary" ? "bg-primary/10" : "bg-muted/50"
        }`}
      >
        <Icon className={`size-4 ${tone === "primary" ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div className="flex flex-col">
        <AnimatedNumber
          value={value}
          className={`font-mono text-xl font-bold leading-none tabular-nums ${
            tone === "primary" ? "text-primary text-glow" : "text-foreground"
          }`}
        />
        <span className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
