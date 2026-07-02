"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react"

import { cn } from "@/lib/utils"

type ToastTone = "success" | "error" | "info"

type ToastItem = {
  id: number
  tone: ToastTone
  message: string
}

type ToastContextValue = {
  push: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_ICON: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertTriangle,
  info: Info,
}

const TONE_CLASS: Record<ToastTone, string> = {
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  error: "border-destructive/40 bg-destructive/10 text-foreground/90",
  info: "border-border bg-card/80 text-foreground/80",
}

/**
 * Minimal, dependency-free toast provider. Mount once near the root. Messages
 * are always caller-provided, user-facing strings — never raw errors or stack
 * traces (callers are responsible for passing sanitized text).
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const push = useCallback((message: string, tone: ToastTone = "info") => {
    const id = nextId.current++
    setItems((current) => [...current, { id, tone, message }])
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id))
    }, 5000)
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const value = useMemo(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((item) => {
          const Icon = TONE_ICON[item.tone]
          return (
            <div
              key={item.id}
              role="status"
              aria-live="polite"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg backdrop-blur",
                TONE_CLASS[item.tone],
              )}
            >
              <Icon className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{item.message}</p>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => dismiss(item.id)}
                className="shrink-0 text-muted-foreground transition hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error("useToast must be used inside a ToastProvider.")
  return context
}
