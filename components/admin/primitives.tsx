import Link from "next/link"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div>
        <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.2em]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </header>
  )
}

export function MetricCard({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="border border-border bg-card/45 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  )
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("border border-border bg-card/40 p-4", className)}>{children}</section>
}

export function SearchFilter({
  placeholder = "Pesquisar",
  statusOptions,
}: {
  placeholder?: string
  statusOptions?: Array<{ value: string; label: string }>
}) {
  return (
    <form className="mb-4 flex flex-wrap gap-2">
      <input
        name="q"
        placeholder={placeholder}
        className="h-9 min-w-56 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
      />
      {statusOptions ? (
        <select
          name="status"
          defaultValue=""
          className="h-9 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
        >
          <option value="">Status</option>
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : null}
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  )
}

export function TableShell({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto border border-border bg-card/40">{children}</div>
}

export function DataTable({
  headers,
  children,
}: {
  headers: string[]
  children: React.ReactNode
}) {
  return (
    <table className="w-full min-w-[860px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-border bg-background/80 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {headers.map((header) => (
            <th key={header} className="px-3 py-2 font-medium">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">{children}</tbody>
    </table>
  )
}

export function EmptyState({ children = "Nenhum registro encontrado." }: { children?: React.ReactNode }) {
  return <div className="border border-dashed border-border bg-card/30 p-8 text-center text-sm text-muted-foreground">{children}</div>
}

export function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number
  totalPages: number
  basePath: string
}) {
  const previous = Math.max(1, page - 1)
  const next = Math.min(totalPages, page + 1)
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Página {page} de {totalPages}
      </span>
      <div className="flex gap-2">
        <Link
          href={`${basePath}?page=${previous}`}
          aria-disabled={page <= 1}
          className={cn(
            "inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] text-foreground transition hover:bg-muted",
            page <= 1 && "pointer-events-none opacity-50",
          )}
        >
          Anterior
        </Link>
        <Link
          href={`${basePath}?page=${next}`}
          aria-disabled={page >= totalPages}
          className={cn(
            "inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] text-foreground transition hover:bg-muted",
            page >= totalPages && "pointer-events-none opacity-50",
          )}
        >
          Próxima
        </Link>
      </div>
    </div>
  )
}

export function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "good" | "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-xs",
        tone === "good" && "border-primary/30 bg-primary/10 text-primary",
        tone === "warn" && "border-yellow-500/25 bg-yellow-500/10 text-yellow-200",
        tone === "bad" && "border-destructive/30 bg-destructive/10 text-destructive",
        tone === "default" && "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}
