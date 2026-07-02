import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Ban, CheckCircle2, KeyRound, ShieldCheck, UserPlus } from "lucide-react"

import {
  blockUserAction,
  changeRoleAction,
  createUserFormAction,
  forcePasswordChangeAction,
  reactivateUserAction,
} from "@/app/usuarios/actions"
import { ActionForm } from "@/components/admin/action-form"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from "@/lib/auth/session"
import { listUsersForAdmin } from "@/lib/auth/users"
import { isRole, roleValues } from "@/lib/auth/permissions"

function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@")
  const visible = local.slice(0, 2)
  return `${visible}${"*".repeat(Math.max(3, local.length - 2))}@${domain}`
}

export default async function UsersPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser) redirect("/login")
  if (currentUser.mustChangePassword) redirect("/alterar-senha")
  if (currentUser.banned) redirect("/login")
  if (currentUser.role !== "owner") redirect("/")

  const users = await listUsersForAdmin()

  return (
    <main className="min-h-dvh bg-background px-4 py-5 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              aria-label="Voltar"
              className="flex size-8 items-center justify-center rounded-lg border border-border bg-background/60 text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div>
              <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.2em]">Usuários</h1>
              <p className="mt-1 text-sm text-muted-foreground">Administração interna</p>
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            Owner only
          </span>
        </header>

        <section className="border border-border bg-card/40 p-4">
          <ActionForm
            action={createUserFormAction}
            successMessage="Usuário criado."
            clearFieldsOnError={["password"]}
            className="grid gap-3 md:grid-cols-[1fr_1fr_150px_1fr_auto]"
            submitLabel="Criar"
            submitIcon={<UserPlus className="size-4" />}
          >
            <input
              name="name"
              placeholder="Nome"
              autoComplete="name"
              className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
              required
            />
            <input
              name="email"
              type="email"
              placeholder="E-mail"
              autoComplete="email"
              className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
              required
            />
            <select
              name="role"
              defaultValue="viewer"
              className="h-10 rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
            >
              {roleValues.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <input
              name="password"
              type="password"
              placeholder="Senha temporária"
              autoComplete="new-password"
              minLength={14}
              className="h-10 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-primary"
              required
            />
          </ActionForm>
        </section>

        <section className="overflow-hidden border border-border bg-card/40">
          <div className="grid grid-cols-[1.2fr_1.4fr_120px_120px_150px_220px] gap-px overflow-x-auto bg-border text-sm">
            <HeaderCell>Nome</HeaderCell>
            <HeaderCell>E-mail</HeaderCell>
            <HeaderCell>Papel</HeaderCell>
            <HeaderCell>Status</HeaderCell>
            <HeaderCell>Criado em</HeaderCell>
            <HeaderCell>Ações</HeaderCell>
            {users.map((row) => {
              const role = isRole(row.role) ? row.role : "viewer"
              return (
                <div key={row.id} className="contents">
                  <Cell>{row.name}</Cell>
                  <Cell>{maskEmail(row.email)}</Cell>
                  <Cell>
                    <form action={changeRoleAction} className="flex gap-2">
                      <input type="hidden" name="userId" value={row.id} />
                      <select
                        name="role"
                        defaultValue={role}
                        className="h-8 w-full rounded-lg border border-border bg-background/70 px-2 text-xs outline-none focus:border-primary"
                      >
                        {roleValues.map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="icon" variant="outline" aria-label="Alterar papel">
                        <CheckCircle2 className="size-3.5" />
                      </Button>
                    </form>
                  </Cell>
                  <Cell>{row.banned ? "bloqueado" : row.mustChangePassword ? "troca pendente" : "ativo"}</Cell>
                  <Cell>{new Intl.DateTimeFormat("pt-BR").format(row.createdAt)}</Cell>
                  <Cell>
                    <div className="flex gap-2">
                      <form action={forcePasswordChangeAction}>
                        <input type="hidden" name="userId" value={row.id} />
                        <Button type="submit" size="icon" variant="outline" aria-label="Forçar troca de senha">
                          <KeyRound className="size-3.5" />
                        </Button>
                      </form>
                      {row.banned ? (
                        <form action={reactivateUserAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <Button type="submit" size="icon" variant="outline" aria-label="Reativar usuário">
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        </form>
                      ) : (
                        <form action={blockUserAction}>
                          <input type="hidden" name="userId" value={row.id} />
                          <Button type="submit" size="icon" variant="destructive" aria-label="Bloquear usuário">
                            <Ban className="size-3.5" />
                          </Button>
                        </form>
                      )}
                    </div>
                  </Cell>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </main>
  )
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </div>
  )
}

function Cell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-14 bg-card/60 px-3 py-3 text-foreground/85">{children}</div>
}
