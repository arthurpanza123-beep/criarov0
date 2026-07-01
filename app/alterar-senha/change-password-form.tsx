"use client"

import { Eye, EyeOff, Loader2, Save } from "lucide-react"
import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { changePasswordAction } from "@/app/alterar-senha/actions"
import type { ChangePasswordState } from "@/app/alterar-senha/actions"

const initialState: ChangePasswordState = {}

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState)
  const [visible, setVisible] = useState(false)
  const type = visible ? "text" : "password"

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4">
      <PasswordField name="currentPassword" label="Senha atual" type={type} autoComplete="current-password" />
      <PasswordField name="newPassword" label="Nova senha" type={type} autoComplete="new-password" />
      <PasswordField name="confirmPassword" label="Confirmar nova senha" type={type} autoComplete="new-password" />

      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {visible ? "Ocultar senhas" : "Mostrar senhas"}
      </button>

      {state.error && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground/80">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full ring-glow" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        Alterar senha
      </Button>
    </form>
  )
}

function PasswordField({
  name,
  label,
  type,
  autoComplete,
}: {
  name: string
  label: string
  type: string
  autoComplete: string
}) {
  return (
    <div className="space-y-2">
      <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        autoComplete={autoComplete}
        minLength={14}
        className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"
        required
      />
    </div>
  )
}
