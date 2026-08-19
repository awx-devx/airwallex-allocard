'use client'

import { useSession } from 'next-auth/react'
import type { z } from 'zod'
import { call, type CallArgs } from '@/client/api/client'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { getActiveOrgId } from '@/client/providers/activeOrg'
import type { Contract } from '@/shared/contracts/types'

export type SessionOrgGate = {
  status: 'loading' | 'authenticated' | 'unauthenticated'
  onboarded?: boolean
}

/**
 * Drop a leftover `allocard:activeOrgId` once we know the session is signed out
 * or not onboarded. While session is loading, keep the stored org so multi-org
 * users still send `x-org-id` on first paint.
 */
export function orgIdForSession(
  orgId: string | null | undefined,
  session: SessionOrgGate,
): string | null | undefined {
  if (session.status === 'unauthenticated') return null
  if (session.status === 'authenticated' && session.onboarded === false) return null
  return orgId
}

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
 * Omits the header when the session is signed out or not yet onboarded.
 */
export function useCall() {
  const { orgId } = useActiveOrg()
  const { data: session, status } = useSession()
  const resolvedOrgId = orgIdForSession(orgId, {
    status,
    onboarded: session?.onboarded,
  })
  return function callWithOrg<C extends Contract>(
    contract: C,
    args?: CallArgs<C>,
  ): Promise<z.infer<C['output']>> {
    return call(contract, withActiveOrgId(args, resolvedOrgId))
  }
}
