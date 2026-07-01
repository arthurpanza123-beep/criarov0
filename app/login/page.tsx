import { redirect } from "next/navigation"

import { AmbientBackground } from "@/components/ambient-background"
import { getCurrentUser } from "@/lib/auth/session"
import { LoginForm } from "@/app/login/login-form"

export default async function LoginPage() {
  const currentUser = await getCurrentUser()
  if (currentUser && !currentUser.banned) {
    redirect(currentUser.mustChangePassword ? "/alterar-senha" : "/")
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4">
      <AmbientBackground />
      <section className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <span className="flex size-2 rounded-full bg-primary glow-sm" aria-hidden />
          <h1 className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-foreground">
            Credit Console
          </h1>
        </div>
        <LoginForm />
      </section>
    </main>
  )
}
