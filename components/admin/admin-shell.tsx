"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  LogOut,
  Megaphone,
  Settings,
  Users,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AuthUser } from "@/lib/auth/types"

type NavItem = {
  href: string
  label: string
  icon: string
}

const icons = {
  dashboard: ChartNoAxesCombined,
  contas: Building2,
  campanhas: Megaphone,
  indicacoes: BriefcaseBusiness,
  clientes: Users,
  pedidos: ClipboardList,
  creditos: CircleDollarSign,
  atividades: Activity,
  notificacoes: Bell,
  configuracoes: Settings,
} as const

export function AdminShell({
  children,
  user,
  navItems,
  unreadNotifications,
  logoutAction,
}: {
  children: React.ReactNode
  user: Pick<AuthUser, "name" | "role">
  navItems: NavItem[]
  unreadNotifications: number
  logoutAction: () => Promise<void>
}) {
  const pathname = usePathname()

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="fixed inset-0 -z-10 bg-grid opacity-70" />
      <div className="flex min-h-dvh">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card/55 px-3 py-4 backdrop-blur md:block">
          <Link href="/" className="mb-5 flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 font-mono text-sm text-primary">
              CF
            </span>
            <span>
              <span className="block font-mono text-xs font-semibold uppercase tracking-[0.18em]">Credit Console</span>
              <span className="block text-xs text-muted-foreground">Painel administrativo</span>
            </span>
          </Link>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = icons[item.icon as keyof typeof icons] ?? ChartNoAxesCombined
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
                    active && "border border-border bg-muted/70 text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.href === "/notificacoes" && unreadNotifications > 0 ? (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {unreadNotifications}
                    </span>
                  ) : null}
                </Link>
              )
            })}
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/88 px-4 backdrop-blur md:px-6">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Sistema real</p>
              <p className="truncate text-sm text-foreground/90">
                {user.name} <span className="text-muted-foreground">/ {user.role}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/notificacoes"
                className="relative flex size-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition hover:text-foreground"
                aria-label="Notificações"
              >
                <Bell className="size-4" />
                {unreadNotifications > 0 ? (
                  <span className="absolute -right-1 -top-1 size-4 rounded-full bg-primary text-center text-[10px] font-semibold leading-4 text-primary-foreground">
                    {Math.min(unreadNotifications, 9)}
                  </span>
                ) : null}
              </Link>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" size="sm">
                  <LogOut className="size-4" />
                  Sair
                </Button>
              </form>
            </div>
          </header>
          <div className="border-b border-border bg-card/35 px-3 py-2 md:hidden">
            <nav className="flex gap-2 overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="whitespace-nowrap rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <main className="flex-1 px-4 py-5 md:px-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
