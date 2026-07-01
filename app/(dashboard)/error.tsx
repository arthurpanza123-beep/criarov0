"use client"

import Link from "next/link"

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Erro</p>
        <h2 className="mt-1 font-mono text-sm font-semibold uppercase tracking-[0.2em]">
          Não foi possível carregar esta página
        </h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Ocorreu um erro ao processar a página ou seu papel não tem acesso a este recurso. Nenhum detalhe técnico é
          exposto.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => reset()}
          className="inline-flex h-9 items-center rounded-lg border border-border bg-background px-3 text-sm transition hover:bg-muted"
        >
          Tentar novamente
        </button>
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-lg border border-border bg-primary px-3 text-sm text-primary-foreground transition hover:opacity-90"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  )
}
