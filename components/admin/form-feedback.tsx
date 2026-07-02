"use client"

import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import type { FormActionState } from "@/lib/admin/form-state-types"

/**
 * General (non-field) error banner. Always a short, sanitized, user-facing
 * message — never a stack trace or raw driver/database error.
 */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground/80">
      {message}
    </p>
  )
}

/** Inline error for a single field, rendered right below its input. */
export function FieldError({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null
  return (
    <p role="alert" className="text-xs text-destructive">
      {messages[0]}
    </p>
  )
}

/** Submit button that disables itself and shows a spinner while pending. */
export function SubmitButton({
  pending,
  children,
  icon,
  className,
  ...props
}: {
  pending: boolean
  children: React.ReactNode
  icon?: React.ReactNode
} & Omit<React.ComponentProps<typeof Button>, "disabled">) {
  return (
    <Button type="submit" disabled={pending} className={cn("ring-glow", className)} {...props}>
      {pending ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </Button>
  )
}

/**
 * Wires a `FormActionState` produced by `runFormAction`/`useActionState` to:
 * - focus the first invalid field (by `name`) after a failed submission;
 * - fire a success toast with `successMessage` when the action succeeds;
 * - optionally clear one or more sensitive fields (e.g. password inputs) on
 *   failure, so a wrong/rejected password is never left sitting in the DOM.
 *
 * Pass the form's ref and the `FormActionState` from `useActionState`. Safe to
 * call on every render; it only reacts when `submissionId` changes.
 */
export function useFormFeedback<T>(
  formRef: React.RefObject<HTMLFormElement | null>,
  state: FormActionState<T>,
  options: { successMessage?: string; clearFieldsOnError?: string[] } = {},
) {
  const { push } = useToast()
  const lastHandledSubmission = useRef(0)

  useEffect(() => {
    if (state.submissionId === 0) return
    if (state.submissionId === lastHandledSubmission.current) return
    lastHandledSubmission.current = state.submissionId

    if (state.success) {
      if (options.successMessage) push(options.successMessage, "success")
      return
    }

    if (state.error) push(state.error, "error")

    const form = formRef.current
    if (!form) return

    const firstErrorField = state.fieldErrors ? Object.keys(state.fieldErrors)[0] : undefined
    if (firstErrorField) {
      const el = form.elements.namedItem(firstErrorField) as HTMLElement | RadioNodeList | null
      const target = el instanceof RadioNodeList ? (el.item(0) as HTMLElement | null) : el
      target?.focus?.()
    }

    for (const fieldName of options.clearFieldsOnError ?? []) {
      const el = form.elements.namedItem(fieldName)
      if (el instanceof HTMLInputElement) el.value = ""
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.submissionId])
}
