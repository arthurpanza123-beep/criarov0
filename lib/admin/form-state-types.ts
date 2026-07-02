/**
 * Generic, serializable state for form feedback consumed by `useActionState`.
 * Never carries a stack trace or a raw database/driver error message — only
 * short, user-facing strings. `fieldErrors` map to input `name` attributes so
 * the client can render inline messages and focus the first invalid field.
 *
 * Intentionally has zero imports (no `server-only`, no auth/session) so it can
 * be safely imported from client components without pulling server-only code
 * (DB client, auth) into the browser bundle.
 */
export type FormActionState<T = null> = {
  success: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  data?: T
  /** Monotonically increasing token so the client can detect a *new* result
   * (including a repeated identical error) across submissions of the same form. */
  submissionId: number
}

export function initialFormState<T = null>(): FormActionState<T> {
  return { success: false, submissionId: 0 }
}
