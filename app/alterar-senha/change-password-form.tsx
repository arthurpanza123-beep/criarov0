"use client"

import { Eye, EyeOff, Save } from "lucide-react"
import { useActionState, useRef, useState } from "react"

import { FormError, SubmitButton, useFormFeedback } from "@/components/admin/form-feedback"
import { changePasswordAction } from "@/app/alterar-senha/actions"
import type { ChangePasswordState } from "@/app/alterar-senha/actions"

const initialState: ChangePasswordState = { success: false, submissionId: 0 }

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState)
  const [visible, setVisible] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const type = visible ? "text" : "password"

  useFormFeedback(formRef, state, {
    clearFieldsOnError: ["currentPassword", "newPassword", "confirmPassword"],
  })

  return (
    <form ref={formRef} action={formAction} className="w-full max-w-sm space-y-4">
      <PasswordField name="currentPassword" label="Senha atual" type={type} autoComplete="current-password" invalid={!!state.error} />
      <PasswordField name="newPassword" label="Nova senha" type={type} autoComplete="new-password" invalid={!!state.error} />
      <PasswordField name="confirmPassword" label="Confirmar nova senha" type={type} autoComplete="new-password" invalid={!!state.error} />

      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
      >
        {visible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        {visible ? "Ocultar senhas" : "Mostrar senhas"}
      </button>

      <FormError message={state.error} />

      <SubmitButton pending={pending} icon={<Save />} size="lg" className="w-full">
        Alterar senha
      </SubmitButton>
    </form>
  )
}

function PasswordField({
  name,
  label,
  type,
  autoComplete,
  invalid,
}: {
  name: string
  label: string
  type: string
  autoComplete: string
  invalid?: boolean
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
        aria-invalid={invalid}
        className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-3 focus:ring-primary/20"
        required
      />
    </div>
  )
}
