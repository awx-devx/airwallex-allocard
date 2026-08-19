'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import { useCall } from '@/client/hooks/useCall'
import { reconcileActiveOrg } from '@/client/providers/activeOrg'
import { qk } from '@/client/queryKeys'
import { authContracts } from '@/shared/contracts/auth'
import { mePermissionsContracts } from '@/shared/contracts/mePermissions'
import type { Contract } from '@/shared/contracts/types'
import type { CallArgs } from '@/client/api/client'

export type ContractCaller = <C extends Contract>(
  contract: C,
  args?: CallArgs<C>,
) => Promise<z.infer<C['output']>>

export function meQueryOptions(callWithOrg: ContractCaller) {
  return {
    queryKey: qk.me(),
    queryFn: () => callWithOrg(authContracts.me),
  }
}

export function permissionsQueryOptions(callWithOrg: ContractCaller) {
  return {
    queryKey: qk.permissions(),
    queryFn: () => callWithOrg(mePermissionsContracts.get),
  }
}

export function onboardingStatusQueryOptions(callWithOrg: ContractCaller) {
  return {
    queryKey: qk.onboardingStatus(),
    queryFn: () => callWithOrg(authContracts.onboardingStatus),
  }
}

export function useMe() {
  const callWithOrg = useCall()
  const query = useQuery(meQueryOptions(callWithOrg))

  useEffect(() => {
    if (!query.data) return
    reconcileActiveOrg({
      membershipOrgIds: query.data.memberships.map((row) => row.orgId),
      fallback: query.data.activeOrg?.id ?? null,
    })
  }, [query.data])

  return query
}

export function usePermissions() {
  const callWithOrg = useCall()
  return useQuery(permissionsQueryOptions(callWithOrg))
}

export function useOnboardingStatus() {
  const callWithOrg = useCall()
  return useQuery(onboardingStatusQueryOptions(callWithOrg))
}

export function useUpdateMe() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof authContracts.updateMe.input>) =>
      callWithOrg(authContracts.updateMe, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateMe', { variables, data })
    },
  })
}

export function useSignUp() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof authContracts.signUp.input>) =>
      callWithOrg(authContracts.signUp, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useSignUp', { variables, data })
    },
  })
}
