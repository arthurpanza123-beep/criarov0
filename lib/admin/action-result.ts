export type ActionResult<T = null> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export const ok = <T>(data: T): ActionResult<T> => ({ success: true, data })

export const fail = (
  error = "Não foi possível concluir a ação.",
  fieldErrors?: Record<string, string[]>,
): ActionResult<never> => ({
  success: false,
  error,
  fieldErrors,
})
