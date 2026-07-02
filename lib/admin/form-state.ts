import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import type { Action, Resource } from "@/lib/auth/types"
import { AuthGuardError, requirePermission } from "@/lib/auth/session"
import { initialFormState, type FormActionState } from "@/lib/admin/form-state-types"

export { initialFormState, type FormActionState }

function nextSubmissionId(previous: number) {
  return previous + 1
}

const GENERIC_ERROR = "Não foi possível concluir a ação. Tente novamente."

/**
 * Maps a caught error to a short, safe, user-facing message. Never forwards
 * raw driver/ORM/Postgres error text (which can contain column/constraint
 * names or, in rare cases, fragments of query values) to the client.
 */
function safeActionErrorMessage(error: unknown): string {
  if (error instanceof AuthGuardError) {
    return error.status === 401 ? "Sessão expirada. Faça login novamente." : "Você não tem permissão para esta ação."
  }
  if (error instanceof z.ZodError) return "Verifique os campos destacados."
  if (error instanceof KnownFormError) return error.message
  return GENERIC_ERROR
}

/**
 * Throw this from within a form action's operation to surface a short,
 * intentional, user-facing message (e.g. "Conta não encontrada."). Anything
 * else thrown (driver errors, unexpected exceptions) is replaced by a generic
 * message before reaching the client.
 */
export class KnownFormError extends Error {}

/**
 * Server Action helper for forms that need inline feedback (general error,
 * per-field error, success) via `useActionState`. Unlike `guardedAction`
 * (which discards the result to satisfy `<form action>`'s `void` signature),
 * this is meant to be bound through `useActionState(action, initialState)`,
 * which already provides the required `(state, formData) => Promise<state>`
 * signature.
 */
export async function runFormAction<T>(
  resource: Resource,
  action: Action,
  paths: string[],
  previousState: FormActionState<T>,
  operation: (actorId: string, formData: FormData) => Promise<T>,
  formData: FormData,
): Promise<FormActionState<T>> {
  const submissionId = nextSubmissionId(previousState.submissionId)
  try {
    const actor = await requirePermission(resource, action)
    const data = await operation(actor.id, formData)
    for (const path of paths) revalidatePath(path)
    return { success: true, data, submissionId }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: safeActionErrorMessage(error), fieldErrors: error.flatten().fieldErrors, submissionId }
    }
    return { success: false, error: safeActionErrorMessage(error), submissionId }
  }
}
