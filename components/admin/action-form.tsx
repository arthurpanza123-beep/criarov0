"use client"

import { cloneElement, isValidElement, useActionState, useRef } from "react"

import { FieldError, SubmitButton, useFormFeedback } from "@/components/admin/form-feedback"
import { initialFormState, type FormActionState } from "@/lib/admin/form-state-types"

type FormAction<T> = (state: FormActionState<T>, formData: FormData) => Promise<FormActionState<T>>

/**
 * Generic wrapper around `useActionState` for admin CRUD forms. Replaces a
 * plain `<form action={serverAction}>` with inline feedback (general error,
 * per-field error, focus on the first invalid field, and a success toast)
 * without duplicating that wiring on every page.
 *
 * `children` must be plain JSX elements (already-instantiated, e.g.
 * `<input name="email" .../>`), never a function/render-prop: a Server
 * Component page cannot pass a function across the server->client boundary,
 * only serializable data (including React elements, which are plain
 * {type, props} objects) or "use server" actions. Each direct child that has
 * a `name` prop gets `aria-invalid` injected and an inline `FieldError`
 * rendered right after it, driven by the action's `fieldErrors`.
 */
export function ActionForm<T = null>({
  action,
  children,
  submitLabel,
  submitIcon,
  submitVariant,
  className,
  successMessage,
  clearFieldsOnError,
}: {
  action: FormAction<T>
  children: React.ReactNode
  submitLabel: string
  submitIcon?: React.ReactNode
  submitVariant?: React.ComponentProps<typeof SubmitButton>["variant"]
  className?: string
  successMessage?: string
  clearFieldsOnError?: string[]
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState<T>())
  const formRef = useRef<HTMLFormElement>(null)

  useFormFeedback(formRef, state, { successMessage, clearFieldsOnError })

  return (
    <form ref={formRef} action={formAction} className={className}>
      {mapChildren(children, state)}
      <SubmitButton pending={pending} icon={submitIcon} variant={submitVariant}>
        {submitLabel}
      </SubmitButton>
    </form>
  )
}

function mapChildren(children: React.ReactNode, state: FormActionState<unknown>): React.ReactNode {
  return reactChildren(children).map((child, index) => {
    if (!isValidElement(child)) return child
    const props = child.props as Record<string, unknown>
    const name = typeof props.name === "string" ? props.name : undefined
    const fieldErrors = name ? state.fieldErrors?.[name] : undefined
    const cloned = name ? cloneElement(child, { "aria-invalid": Boolean(fieldErrors) } as never) : child
    return (
      <span key={name ?? index} className="contents">
        {cloned}
        {fieldErrors ? <FieldError messages={fieldErrors} /> : null}
      </span>
    )
  })
}

function reactChildren(children: React.ReactNode): React.ReactNode[] {
  return Array.isArray(children) ? children : [children]
}
