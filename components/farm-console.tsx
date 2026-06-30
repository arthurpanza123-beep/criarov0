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
type FeedItem = { id: string; email: string; t: string }
type Tab = "farm" | "settings"

const PER_ACCOUNT = 5

function nowTime() {
  return new Date().toLocaleTimeString("pt-BR", { hour12: false })
}

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
  // Capacidade total considerando contas já usadas + disponíveis
  const capacityAccounts = available + usedCount
  const missingAccounts =
    mode === "goal" ? Math.max(0, neededForGoal - capacityAccounts) : 0
  const missingUsd = missingAccounts * PER_ACCOUNT

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
          { id: `${current.email}-${Date.now()}`, email: current.email, t: nowTime() },
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

  const statusLabel =
    state === "running"
      ? "EM EXECUÇÃO"
      : state === "paused"
        ? "PAUSADO"
        : state === "done"
          ? "CONCLUÍDO"
          : "OCIOSO"

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
  // Reset limpa apenas o estado/contadores da sessão.
  // NÃO restaura contas já farmadas — elas já foram convidadas e saem para sempre.
  function reset() {
    if (timerRef.current) clearInterval(timerRef.current)
    progressRef.current = 0
    setCurProgress(0)
    setUsedCount(0)
    setActiveEmail(null)
    setFeed([])
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
    <section className="mx-auto flex h-dvh max-w-6xl flex-col p-3 md:p-5">
      {/* Painel-terminal emoldurado */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card/40 shadow-[0_30px_80px_-40px_oklch(0_0_0_/_0.9)] backdrop-blur-xl">
        <CornerTicks />

        {/* Barra de título */}
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/30 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-primary/20 blur-lg" />
              <Image
                src="/credit-farm-mascot.png"
                alt="Credit Farm"
                width={96}
                height={96}
                className="h-9 w-9 object-contain drop-shadow-[0_2px_6px_oklch(0_0_0_/_0.5)]"
                priority
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-semibold leading-none tracking-tight">
                Credit <span className="text-primary">Farm</span>
              </h1>
              <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Automation Terminal
              </span>
            </div>

            {/* Status */}
            <div className="ml-2 hidden items-center gap-2 rounded-full border border-border bg-background/50 px-2.5 py-1 sm:flex">
              <span className="relative flex size-1.5">
                {state === "running" && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75" />
                )}
                <span
                  className={`relative inline-flex size-1.5 rounded-full ${
                    state === "running" || state === "done" ? "bg-primary" : "bg-muted-foreground/50"
                  }`}
                />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Saldo */}
            <div className="hidden items-baseline gap-1.5 border-r border-border pr-4 sm:flex">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Saldo
              </span>
              <AnimatedNumber
                value={earnings}
                prefix="$"
                decimals={0}
                className="font-mono text-lg font-bold leading-none tabular-nums text-primary"
              />
            </div>

            {/* Abas */}
            <div className="flex gap-1 rounded-lg border border-border bg-background/50 p-1">
              <TabButton active={tab === "farm"} onClick={() => setTab("farm")} icon={Activity} label="Farm" />
              <TabButton
                active={tab === "settings"}
                onClick={() => setTab("settings")}
                icon={SettingsIcon}
                label="Config"
              />
            </div>
          </div>
        </header>

        {/* Corpo */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {tab === "farm" ? (
              <motion.div
                key="farm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="grid h-full min-h-0 gap-px overflow-y-auto bg-border lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:overflow-hidden"
              >
                {/* Coluna esquerda */}
                <div className="flex min-h-0 flex-col bg-card/30">
                  {/* Núcleo */}
                  <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-5">
                    <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
                    {state === "running" && (
                      <div className="pointer-events-none absolute inset-0 animate-shimmer bg-gradient-to-b from-transparent via-primary/[0.06] to-transparent" />
                    )}

                    <span className="relative mb-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      Farm Core
                    </span>

                    <div className="relative">
                      <FarmCore state={state} progress={coreProgress} size={172} />
                    </div>

                    {/* Centro: mínimo quando ocioso, ganhos/processo após iniciar */}
                    <div className="relative mt-4 flex w-full max-w-[280px] flex-col items-center">
                      <AnimatePresence mode="wait">
                        {state === "idle" ? (
                          <motion.p
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground"
                          >
                            Pronto para iniciar
                          </motion.p>
                        ) : (
                          <motion.div
                            key="active"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex w-full flex-col items-center"
                          >
                            <AnimatedNumber
                              value={earnings}
                              prefix="$"
                              decimals={0}
                              className="block font-mono text-5xl font-bold tabular-nums text-primary text-glow"
                            />
                            <AnimatePresence mode="wait">
                              <motion.p
                                key={state + activeStep.label}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="mt-1.5 h-4 font-mono text-[11px] text-muted-foreground"
                              >
                                {state === "running" && (
                                  <span className="text-primary">{activeStep.label}</span>
                                )}
                                {state === "paused" && "Aguardando retomada"}
                                {state === "done" && (
                                  <span className="text-primary">
                                    {usedCount} contas concluídas
                                  </span>
                                )}
                              </motion.p>
                            </AnimatePresence>

                            <div className="mt-3 w-full">
                              <div className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider">
                                <span className="text-muted-foreground">
                                  {mode === "goal"
                                    ? `${usedCount}/${neededForGoal} · meta $${goalUsd}`
                                    : `${usedCount} farmadas`}
                                </span>
                                <span className="font-semibold text-primary">{overall}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className="h-full rounded-full bg-primary glow-sm"
                                  animate={{ width: `${overall}%` }}
                                  transition={{ duration: 0.4, ease: "easeOut" }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Leituras de dados */}
                  <div className="grid shrink-0 grid-cols-3 divide-x divide-border border-y border-border">
                    <Readout label="Disponíveis" value={available} accent />
                    <Readout label="Usadas" value={usedCount} />
                    <Readout label="Por conta" value={PER_ACCOUNT} prefix="$" />
                  </div>

                  {/* Aviso: meta maior que a capacidade das contas */}
                  <AnimatePresence initial={false}>
                    {mode === "goal" && missingAccounts > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden px-4"
                      >
                        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5">
                          <Target className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                          <p className="font-mono text-[11px] leading-relaxed text-foreground/80">
                            Faltam{" "}
                            <span className="font-semibold text-destructive">
                              {missingAccounts} contas
                            </span>{" "}
                            (${missingUsd}) para a meta de{" "}
                            <span className="font-semibold">${goalUsd}</span>. Adicione mais
                            contas ou reduza a meta.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Controles */}
                  <div className="flex shrink-0 gap-2 p-4">
                    {state !== "running" ? (
                      <Button
                        onClick={start}
                        size="lg"
                        className="group flex-1 font-medium ring-glow"
                        disabled={available === 0}
                      >
                        <Play className="transition-transform group-hover:scale-110" />
                        {state === "paused" ? "Retomar farm" : "Iniciar farm"}
                      </Button>
                    ) : (
                      <Button onClick={pause} size="lg" variant="secondary" className="flex-1 font-medium">
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

                {/* Coluna direita: log ao vivo */}
                <div className="flex min-h-0 flex-col bg-card/30">
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Activity className="size-3.5 text-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        Live Activity
                      </span>
                      {feed.length > 0 && (
                        <span className="rounded-full border border-border bg-background/50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-foreground/70">
                          {feed.length}
                        </span>
                      )}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => setModalOpen(true)}>
                      <Plus className="size-3.5" />
                      Adicionar
                    </Button>
                  </div>

                  <div className="relative min-h-0 flex-1 overflow-y-auto">
                    {/* Conta em processamento (fixa no topo) */}
                    <AnimatePresence>
                      {state === "running" && activeEmail && (
                        <motion.div
                          key={`active-${activeEmail}`}
                          layout
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="sticky top-0 z-10 overflow-hidden border-b border-primary/30 bg-primary/[0.07] p-4 backdrop-blur-sm"
                        >
                          <motion.div
                            className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10"
                            animate={{ width: `${curProgress}%` }}
                            transition={{ duration: 0.2, ease: "linear" }}
                          />
                          <div className="relative flex items-center gap-2.5">
                            <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                            <span className="flex-1 truncate font-mono text-xs font-medium text-primary">
                              {maskEmail(activeEmail)}
                            </span>
                            <span className="font-mono text-[11px] font-semibold tabular-nums text-primary">
                              {Math.round(curProgress)}%
                            </span>
                          </div>

                          <div className="relative mt-2.5 flex items-center justify-between gap-2">
                            <AnimatePresence mode="wait">
                              <motion.span
                                key={activeStep.label}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-foreground/70"
                              >
                                <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 text-[9px] font-bold text-primary">
                                  {activeStep.index + 1}
                                </span>
                                {activeStep.label}
                              </motion.span>
                            </AnimatePresence>
                            {activeStep.index === 2 && (
                              <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-primary">
                                <Users className="size-3" />
                                {activeStep.invites}/{MAX_INVITES}
                              </span>
                            )}
                          </div>

                          <div className="relative mt-2 flex gap-1">
                            {FARM_STEPS.map((_, i) => (
                              <span
                                key={i}
                                className={`h-0.5 flex-1 rounded-full transition-colors ${
                                  i <= activeStep.index ? "bg-primary" : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {feed.length === 0 && state !== "running" ? (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                        <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-background/40">
                          <MailCheck className="size-5 text-muted-foreground" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-mono text-[11px] uppercase tracking-wider text-foreground/70">
                            Aguardando execução
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            As contas processadas aparecem aqui
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/70">
                        <AnimatePresence initial={false}>
                          {feed.map((item) => (
                            <motion.div
                              key={item.id}
                              layout
                              initial={{ opacity: 0, x: -10, height: 0 }}
                              animate={{ opacity: 1, x: 0, height: "auto" }}
                              className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-primary/[0.04]"
                            >
                              <CheckCircle2 className="size-3.5 shrink-0 text-primary" />
                              <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                                {item.t}
                              </span>
                              <span className="flex-1 truncate font-mono text-xs text-foreground/80">
                                {maskEmail(item.email)}
                              </span>
                              <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-primary">
                                +$5
                              </span>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="grid h-full min-h-0 content-start gap-px overflow-y-auto bg-border lg:grid-cols-3 lg:content-stretch lg:overflow-hidden"
              >
                {/* API Key */}
                <SettingsPanel icon={KeyRound} title="API NotLetters" subtitle="Autentica o worker">
                  <div className="relative">
                    <input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="nl_live_••••••••••••"
                      className="w-full rounded-lg border border-input bg-background/60 px-3 py-2.5 pr-10 font-mono text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
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
                  <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 font-mono text-[10px] uppercase tracking-wider">
                    <span
                      className={`flex size-2 shrink-0 rounded-full transition-colors ${
                        apiKey ? "bg-primary glow-sm" : "bg-muted-foreground/40"
                      }`}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">
                      {apiKey ? "Chave configurada" : "Sem chave"}
                    </span>
                  </div>
                </SettingsPanel>

                {/* Contas / Emails */}
                <SettingsPanel icon={Mail} title="Contas & e-mails" subtitle="Pool de contas">
                  <div className="rounded-lg border border-border bg-background/40 p-4">
                    <div className="flex items-end justify-between">
                      <AnimatedNumber
                        value={available}
                        className="font-mono text-4xl font-bold leading-none tabular-nums text-primary text-glow"
                      />
                      <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        <ShieldCheck className="size-3.5 text-primary" />
                        Mascaradas
                      </span>
                    </div>
                    <span className="mt-1 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      contas no pool
                    </span>
                  </div>

                  <Button className="w-full" variant="secondary" onClick={() => setModalOpen(true)}>
                    <Plus className="size-4" />
                    Adicionar contas
                  </Button>
                  <p className="mt-auto border-t border-border pt-3 text-center font-mono text-[10px] text-muted-foreground">
                    e-mail &gt; senha (uma por linha) ou .txt
                  </p>
                </SettingsPanel>

                {/* Meta de ganhos */}
                <SettingsPanel icon={Target} title="Meta de ganhos" subtitle="Até onde o farm vai">
                  <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-background/40 p-1">
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
                        <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                          Quanto ganhar (USD)
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
                            className="w-full rounded-lg border border-input bg-background/60 py-2.5 pl-9 pr-3 font-mono text-sm outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                          />
                        </div>
                        <div className="mt-3 rounded-lg border border-border bg-background/40 px-3 py-2.5 font-mono text-[11px] leading-relaxed">
                          <span className="text-muted-foreground">Arredondado · </span>
                          <span className="font-semibold text-primary">{neededForGoal} contas</span>
                          <span className="text-muted-foreground"> = </span>
                          <span className="font-semibold text-primary">
                            ${(neededForGoal * PER_ACCOUNT).toLocaleString("pt-BR")}
                          </span>
                          {neededForGoal > available + usedCount && (
                            <span className="text-destructive">
                              {" "}
                              · faltam {neededForGoal - (available + usedCount)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </SettingsPanel>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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

/* ---------- helpers ---------- */

function CornerTicks() {
  const base = "absolute size-3 border-primary/40"
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
      <span className={`${base} left-2 top-2 border-l border-t`} />
      <span className={`${base} right-2 top-2 border-r border-t`} />
      <span className={`${base} bottom-2 left-2 border-b border-l`} />
      <span className={`${base} bottom-2 right-2 border-b border-r`} />
    </div>
  )
}

function Readout({
  label,
  value,
  prefix,
  accent,
}: {
  label: string
  value: number
  prefix?: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <AnimatedNumber
        value={value}
        prefix={prefix}
        className={`font-mono text-2xl font-bold leading-none tabular-nums ${
          accent ? "text-primary" : "text-foreground"
        }`}
      />
    </div>
  )
}

function SettingsPanel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: typeof KeyRound
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 flex-col bg-card/30">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/50">
          <Icon className="size-4 text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-none">{title}</span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {subtitle}
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">{children}</div>
    </div>
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
      className={`relative flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 rounded-md bg-primary"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative flex items-center gap-2">
        <Icon className="size-3.5" />
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
      className={`relative flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="mode-pill"
          className="absolute inset-0 rounded-md bg-primary"
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
