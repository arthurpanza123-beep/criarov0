"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { X, Upload, FileText, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseAccounts } from "@/lib/farm"

export function AddAccountsModal({
  open,
  initialValue,
  onClose,
  onConfirm,
}: {
  open: boolean
  initialValue: string
  onClose: () => void
  onConfirm: (raw: string) => void
}) {
  const [draft, setDraft] = useState(initialValue)
  const fileRef = useRef<HTMLInputElement>(null)

  // Sincroniza o rascunho sempre que abre
  useEffect(() => {
    if (open) setDraft(initialValue)
  }, [open, initialValue])

  // Fecha com ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  const count = parseAccounts(draft).length

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setDraft((prev) => (prev.trim() ? `${prev.trim()}\n${text.trim()}` : text.trim()))
    if (fileRef.current) fileRef.current.value = ""
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
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />

          {/* Painel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Adicionar contas"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-2xl ring-glow"
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold">
                  <Upload className="size-5 text-primary" />
                  Adicionar contas
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cole ou suba um arquivo. Elas vão aparecendo durante o farm.
                </p>
              </div>
              <button
                onClick={onClose}
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
              rows={9}
              spellCheck={false}
              autoFocus
              placeholder={"email@dominio.com > senha\noutro@dominio.com > senha"}
              className="w-full resize-none rounded-lg border border-input bg-background/60 p-3 font-mono text-xs leading-relaxed outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/30"
            />

            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-primary" />
              <span className="font-mono font-semibold text-primary">{count}</span> contas
              detectadas · formatos{" "}
              <code className="text-foreground">{"email > senha"}</code> ou{" "}
              <code className="text-foreground">email:senha</code>
            </div>

            <div className="mt-5 flex gap-3">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => onConfirm(draft)}
                disabled={count === 0}
                className="flex-1 ring-glow"
              >
                Carregar {count > 0 ? `${count} contas` : "contas"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
