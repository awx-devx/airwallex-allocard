import type { Contract } from '@/shared/contracts/types'

/** Extract `:param` names from a contract path template. */
export type PathParamNames<Path extends string> = Path extends `${string}:${infer Rest}`
  ? Rest extends `${infer Name}/${infer Tail}`
    ? Name | PathParamNames<`/${Tail}`>
    : Rest
  : never

/**
 * Params required for a contract path. Empty object when the path has no `:params`.
 * Runtime `buildUrl` still accepts `Record<string, string>`; this type is for callers.
 */
export type PathParams<C extends Contract> = [PathParamNames<C['path']>] extends [never]
  ? Record<string, never> | undefined
  : Record<PathParamNames<C['path']>, string>

const PARAM_RE = /:([A-Za-z_][A-Za-z0-9_]*)/g

export function buildUrl(path: string, params?: Record<string, string>): string {
  const used = new Set<string>()
  const result = path.replace(PARAM_RE, (_match, name: string) => {
    if (!params || params[name] === undefined) {
      throw new Error(`Missing path param :${name} for ${path}`)
    }
    used.add(name)
    return encodeURIComponent(params[name])
  })

  if (params) {
    for (const key of Object.keys(params)) {
      if (!used.has(key)) {
        throw new Error(`Unused path param "${key}" for ${path}`)
      }
    }
  }

  return result
}
