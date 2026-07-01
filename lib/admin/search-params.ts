export type PageSearchParams = Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> | undefined

export async function readSearchParams(searchParams: PageSearchParams) {
  const params = await searchParams
  const result: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(params ?? {})) {
    result[key] = Array.isArray(value) ? value[0] : value
  }
  return result
}
