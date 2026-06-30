"use client"

import { motion, AnimatePresence } from "motion/react"
import { Check } from "lucide-react"

type FarmState = "idle" | "running" | "paused" | "done"

export function FarmCore({
  state,
  progress,
  size = 220,
}: {
  state: FarmState
  progress: number
  size?: number
}) {
  const active = state === "running"
  const done = state === "done"

  // Anel circular de progresso
  const stroke = 10
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * (1 - progress / 100)

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Pulsos quando ativo */}
      <AnimatePresence>
        {active && (
          <>
            <span className="absolute inset-6 rounded-full border border-primary/40 animate-pulse-ring" />
            <span
              className="absolute inset-6 rounded-full border border-primary/30 animate-pulse-ring"
              style={{ animationDelay: "0.8s" }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Glow de conclusão */}
      <AnimatePresence>
        {done && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1.15, opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 rounded-full bg-primary/20 blur-2xl"
          />
        )}
      </AnimatePresence>

      {/* Aro interno decorativo */}
      <span className="absolute rounded-full border border-border/60" style={{ inset: stroke + 10 }} />

      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
          opacity={0.5}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: dash }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            filter: active || done ? "drop-shadow(0 0 8px var(--primary))" : "none",
          }}
        />
      </svg>

      {/* Centro */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 16 }}
              className="flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground ring-glow"
            >
              <Check className="size-8" strokeWidth={3} />
            </motion.div>
          ) : (
            <motion.div key="progress" className="flex flex-col items-center">
              <motion.span
                className="font-mono text-4xl font-bold tabular-nums text-foreground"
                animate={active ? { opacity: [1, 0.7, 1] } : { opacity: 1 }}
                transition={{ duration: 1.6, repeat: active ? Infinity : 0 }}
              >
                {Math.round(progress)}
                <span className="text-xl text-muted-foreground">%</span>
              </motion.span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                {state === "running"
                  ? "Farmando"
                  : state === "paused"
                    ? "Pausado"
                    : "Em espera"}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
