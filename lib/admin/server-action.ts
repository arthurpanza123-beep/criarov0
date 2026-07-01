import "server-only"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { fail, ok, type ActionResult } from "@/lib/admin/action-result"
import type { Action, Resource } from "@/lib/auth/types"
import { AuthGuardError, requirePermission } from "@/lib/auth/session"

export async function runGuardedAction<T>(
  resource: Resource,
  action: Action,
  paths: string[],
  operation: (actorId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const actor = await requirePermission(resource, action)
    const data = await operation(actor.id)
    for (const path of paths) revalidatePath(path)
    return ok(data)
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return fail(error.status === 401 ? "Sessão expirada." : "Acesso negado.")
    }
    if (error instanceof z.ZodError) {
      return fail("Dados inválidos.", error.flatten().fieldErrors)
    }
    if (error instanceof Error && error.message) {
      return fail(error.message)
    }
    return fail()
  }
}

/**
 * Form-facing wrapper. Server Actions bound directly to `<form action>` must
 * resolve to `void | Promise<void>` (React 19 / Next 16). The safe ActionResult
 * is produced and consumed internally so no stack trace ever reaches the client.
 */
export async function guardedAction<T>(
  resource: Resource,
  action: Action,
  paths: string[],
  operation: (actorId: string) => Promise<T>,
): Promise<void> {
  await runGuardedAction(resource, action, paths, operation)
}
