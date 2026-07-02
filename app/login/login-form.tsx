"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, LogIn } from "lucide-react"
import { useRef, useState, type FormEvent } from "react"

import { SubmitButton, FormError } from "@/components/admin/form-feedback"
import { useToast } from "@/components/ui/toast"
import { authClient } from "@/lib/auth/auth-client"
import { sanitizeCallbackUrl } from "@/lib/auth/redirects"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { push } = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const result = await authClient.signIn.email({
      email,
      password,
      callbackURL: sanitizeCallbackUrl(searchParams.get("callbackUrl")),
    })

    setLoading(false)

    if (result.error) {
      // Never keep a rejected password sitting in the DOM.
      setPassword("")
      setError("Não foi possível entrar com esses dados.")
      emailRef.current?.focus()
      return
    }

    push("Login realizado.", "success")
    router.replace(sanitizeCallbackUrl(searchParams.get("callbackUrl")))
    router.refresh()
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="w-full max-w-sm space-y-4" noValidate>
      <div className="space-y-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          ref={emailRef}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(error)}
          className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground" htmlFor="password">
          Senha
        </label>
        <div className="flex h-11 rounded-lg border border-border bg-background/70 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(error)}
            className="min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none"
            required
          />
          <button
            type="button"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setShowPassword((value) => !value)}
            className="flex size-11 items-center justify-center text-muted-foreground transition hover:text-foreground"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <FormError message={error} />

      <SubmitButton pending={loading} icon={<LogIn />} size="lg" className="w-full">
        Entrar
      </SubmitButton>
    </form>
  )
}
