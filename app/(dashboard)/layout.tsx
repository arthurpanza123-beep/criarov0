import { redirect } from "next/navigation"

import { logoutAction } from "@/app/actions/auth"
import { AdminShell } from "@/components/admin/admin-shell"
import { can } from "@/lib/auth/permissions"
import { getCurrentUser } from "@/lib/auth/session"
import type { Resource } from "@/lib/auth/types"
import { notificationsService } from "@/lib/services/notifications-service"

const nav = [
  { href: "/", label: "Dashboard", icon: "dashboard", resource: "dashboard" },
  { href: "/contas", label: "Contas", icon: "contas", resource: "managedAccounts" },
  { href: "/campanhas", label: "Campanhas", icon: "campanhas", resource: "campaigns" },
  { href: "/indicacoes", label: "Indicações", icon: "indicacoes", resource: "referrals" },
  { href: "/clientes", label: "Clientes", icon: "clientes", resource: "customers" },
  { href: "/pedidos", label: "Pedidos", icon: "pedidos", resource: "orders" },
  { href: "/creditos", label: "Créditos", icon: "creditos", resource: "creditLedger" },
  { href: "/jobs", label: "Fila", icon: "jobs", resource: "jobs" },
  { href: "/importacoes", label: "Importações", icon: "importacoes", resource: "imports" },
  { href: "/exportacoes", label: "Exportações", icon: "exportacoes", resource: "dashboard" },
  { href: "/relatorios", label: "Relatórios", icon: "relatorios", resource: "reports" },
  { href: "/atividades", label: "Atividades", icon: "atividades", resource: "activities" },
  { href: "/notificacoes", label: "Notificações", icon: "notificacoes", resource: "dashboard" },
  { href: "/configuracoes", label: "Configurações", icon: "configuracoes", resource: "settings" },
  { href: "/sistema", label: "Sistema", icon: "sistema", resource: "system" },
] satisfies Array<{ href: string; label: string; icon: string; resource: Resource }>

export const dynamic = "force-dynamic"

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect("/login")
  if (currentUser.banned) redirect("/login")
  if (currentUser.mustChangePassword) redirect("/alterar-senha")

  const navItems = nav.filter((item) => can(currentUser.role, item.resource, "read"))
  const unreadNotifications = await notificationsService.unreadCount()

  return (
    <AdminShell
      user={currentUser}
      navItems={navItems}
      unreadNotifications={unreadNotifications}
      logoutAction={logoutAction}
    >
      {children}
    </AdminShell>
  )
}
