"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Coins, Link2, ArrowRight, ArrowLeft, Rocket, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MAX_INVITES } from "@/lib/farm"

const TOKENS_PER_LINK = 200

export type StartConfig = {
  tokens: number
  inviteLinks: string[]
}

export function StartFarmDialog({
  open,
  maxTokens,
  onClose,
  onConfirm,
}: {
  open: boolean
  maxTokens: number
  onClose: () => void
  onConfirm: (config: StartConfig) => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [tokens, setTokens] = useState(200)
  const [links, setLinks] = useState<string[]>([""])

  // nº de campos de link = 1 a cada 200 tokens (arredonda pra cima)
  const requiredLinks = useMemo(
    () => Math.max(1, Math.ceil(tokens / TOKENS_PER_LINK)),
    [tokens],
  )

  // Sincroniza a quantidade de campos com o necessário
  useEffect(() => {
    setLinks((prev) => {
      const next = [...prev]
      while (next.length < requiredLinks) next.push("")
      return next.slice(0, requiredLinks)
    })
  }, [requiredLinks])

  // Reseta ao abrir
  useEffect(() => {
    if (open) {
      setStep(1)
      setTokens(200)
      setLinks([""])
    }
  }, [open])

  if (!open) return null

  const filledLinks = links.filter((l) => l.trim()).length
  // Capacidade: cada conta cobre MAX_INVITES tokens
  const overCapacity = tokens > maxTokens
  const missingTokens = Math.max(0, tokens - maxTokens)
  const missingAccounts = Math.ceil(missingTokens / MAX_INVITES)
  const canContinue = tokens > 0 && !overCapacity
  const canConfirm = canContinue && filledLinks === requiredLinks

  function confirm() {
    if (!canConfirm) return
    onConfirm({ tokens, inviteLinks: links.map((l) => l.trim()) })
  }

  // Enter confirma/avança (ignora durante composição de IME)
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return
    e.preventDefault()
    if (step === 1) {
      if (canContinue) setStep(2)
    } else if (canConfirm) {
      confirm()
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
          aria-label="Fechar"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl ring-glow"
          onKeyDown={handleKeyDown}
        >
          {/* Topo */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                <Rocket className="size-4 text-primary" />
              </span>
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold leading-tight">Iniciar farm</h3>
                <span className="text-xs text-muted-foreground">
                  Passo {step} de 2
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Indicador de passos */}
          <div className="mb-6 flex gap-2">
            <span className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
            <span className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
              >
                <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Coins className="size-4 text-primary" />
                  Quantos tokens você quer no pedido?
                </label>
                <input
                  type="number"
                  min={1}
                  autoFocus
                  value={tokens}
                  onChange={(e) => setTokens(Math.max(0, Number(e.target.value) || 0))}
                  className={`w-full rounded-lg border bg-background/60 px-3 py-3 font-mono text-lg outline-none transition-colors focus:ring-2 ${
                    overCapacity
                      ? "border-destructive/60 focus:border-destructive focus:ring-destructive/30"
                      : "border-input focus:border-primary focus:ring-primary/30"
                  }`}
                />

                {/* Capacidade disponível */}
                <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                  <span className="text-muted-foreground">
                    Capacidade: {maxTokens} tokens
                  </span>
                  <span className="text-muted-foreground">
                    {Math.ceil(maxTokens / MAX_INVITES)} contas · {MAX_INVITES}/conta
                  </span>
                </div>

                {overCapacity ? (
                  <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                    <span className="leading-relaxed text-foreground/80">
                      Você não tem contas suficientes. Faltam{" "}
                      <span className="font-mono font-semibold text-destructive">
                        {missingTokens} tokens
                      </span>{" "}
                      —{" "}
                      <span className="font-semibold text-destructive">
                        +{missingAccounts} conta{missingAccounts > 1 ? "s" : ""}
                      </span>
                      . Adicione mais contas ou reduza o pedido para no máximo{" "}
                      <span className="font-mono font-semibold">{maxTokens}</span>.
                    </span>
                  </div>
                ) : (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
                    <Link2 className="size-3.5 shrink-0 text-primary" />
                    <span className="text-muted-foreground">
                      {tokens <= TOKENS_PER_LINK ? (
                        <>
                          Pedido de{" "}
                          <span className="font-mono font-semibold text-primary">{tokens}</span>{" "}
                          tokens — será pedido{" "}
                          <span className="font-semibold text-primary">1 link de convite</span>.
                        </>
                      ) : (
                        <>
                          Acima de {TOKENS_PER_LINK} tokens — serão pedidos{" "}
                          <span className="font-mono font-semibold text-primary">
                            {requiredLinks} links de convite
                          </span>{" "}
                          (1 a cada {TOKENS_PER_LINK}).
                        </>
                      )}
                    </span>
                  </div>
                )}

                <Button
                  className="mt-6 w-full"
                  size="lg"
                  disabled={!canContinue}
                  onClick={() => setStep(2)}
                >
                  Continuar
                  <ArrowRight />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
              >
                <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <Link2 className="size-4 text-primary" />
                  {requiredLinks === 1
                    ? "Link de convite"
                    : `Links de convite (${requiredLinks})`}
                </label>
                <p className="mb-3 text-xs text-muted-foreground">
                  Cada link cobre até {TOKENS_PER_LINK} tokens · {filledLinks}/{requiredLinks} preenchidos
                </p>

                <div className="flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
                  {links.map((link, i) => (
                    <div key={i} className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                        {i + 1}
                      </span>
                      <input
                        type="url"
                        value={link}
                        placeholder="https://convite.exemplo/abc123"
                        onChange={(e) =>
                          setLinks((prev) =>
                            prev.map((l, idx) => (idx === i ? e.target.value : l)),
                          )
                        }
                        className="w-full rounded-lg border border-input bg-background/60 py-2.5 pl-8 pr-3 font-mono text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex gap-2">
                  <Button variant="outline" size="lg" onClick={() => setStep(1)}>
                    <ArrowLeft />
                    Voltar
                  </Button>
                  <Button className="flex-1 ring-glow" size="lg" disabled={!canConfirm} onClick={confirm}>
                    <Rocket />
                    Iniciar farm
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
