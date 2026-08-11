import type { z } from 'zod'
import { call, type CallArgs } from '@/client/api/client'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { getActiveOrgId } from '@/client/providers/activeOrg'
import type { Contract } from '@/shared/contracts/types'

/** Merge explicit orgId with active-org fallback (module ref). Pure — easy to unit test. */
export function withActiveOrgId<A extends CallArgs<Contract> | undefined>(
  args: A,
  orgId: string | null | undefined = getActiveOrgId(),
): A extends undefined ? { orgId?: string } : A & { orgId?: string } {
  const resolved = args?.orgId ?? orgId ?? undefined
  return { ...(args ?? {}), orgId: resolved } as never
}

/**
 * Typed `call` that injects the active org as `x-org-id`.
 * Prefers React context; falls back to `getActiveOrgId()` module ref.
 */
export function useCall() {
  const { orgId } = useActiveOrg()
  return function callWithOrg<C extends Contract>(
    contract: C,
    args?: CallArgs<C>,
  ): Promise<z.infer<C['output']>> {
    return call(contract, withActiveOrgId(args, orgId))
  }
}
