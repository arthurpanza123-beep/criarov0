"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, FileText, CheckCircle2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseAccounts } from "@/lib/farm"

export function AddAccountsModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (raw: string) => void
}) {
  const [draft, setDraft] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const close = useCallback(() => {
    setDraft("")
    onClose()
  }, [onClose])

  // Fecha com ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, close])

  const count = parseAccounts(draft).length

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()))
    if (fileRef.current) fileRef.current.value = ""
  }

  function confirm() {
    if (count === 0) return
    onAdd(draft)
    setDraft("")
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
            onClick={close}
            aria-hidden
          />

          {/* Painel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar novas contas"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl ring-glow"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
            <div className="mb-5 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                  <Plus className="size-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">Adicionar contas</h2>
                  <p className="text-sm text-muted-foreground">
                    Novas contas entram na fila administrativa
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Upload de arquivo */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <FileText className="size-4" />
              Carregar arquivo .txt
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleFile}
              className="hidden"
            />

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.metaKey || e.ctrlKey) &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  e.preventDefault()
                  confirm()
                }
              }}
              rows={9}
              spellCheck={false}
              autoFocus
              placeholder={"Conta Norte, norte.ops@example.com, Plataforma A, 200\nConta Sul, sul.ops@example.com, Plataforma B, 150"}
              className="w-full resize-none rounded-lg border border-input bg-background/60 p-3 font-mono text-xs leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Pressione{" "}
              <kbd className="rounded border border-border bg-secondary px-1 font-mono">
                Ctrl/Cmd + Enter
              </kbd>{" "}
              para adicionar
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span className="font-mono font-semibold text-primary">{count}</span> contas
              detectadas · formato{" "}
              <code className="text-foreground">rótulo, e-mail, provedor, limite</code>
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="outline" onClick={close} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={confirm} disabled={count === 0} className="flex-1 ring-glow">
                <Plus className="size-4" />
                Adicionar {count > 0 ? `${count} contas` : "contas"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
