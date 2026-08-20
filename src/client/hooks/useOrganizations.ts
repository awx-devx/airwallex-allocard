'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk } from '@/client/queryKeys'
import { inviteContracts } from '@/shared/contracts/invite'
import { organizationContracts } from '@/shared/contracts/organization'

export function organizationQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.org(id),
    queryFn: () => callWithOrg(organizationContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function orgMembersQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.orgMembers(id),
    queryFn: () => callWithOrg(organizationContracts.listMembers, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function invitesQueryOptions(callWithOrg: ContractCaller, enabled = true) {
  return {
    queryKey: qk.invites(),
    queryFn: () => callWithOrg(inviteContracts.list),
    enabled,
  }
}

export function invitePreviewQueryOptions(token: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.invitePreview(token),
    queryFn: () => callWithOrg(inviteContracts.preview, { params: { token } }),
    enabled: Boolean(token),
  }
}

export function useOrganization(id: string) {
  const callWithOrg = useCall()
  return useQuery(organizationQueryOptions(id, callWithOrg))
}

export function useCreateOrganization() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof organizationContracts.create.input>) =>
      callWithOrg(organizationContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateOrganization', { variables, data })
    },
  })
}

export function useUpdateOrganization() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof organizationContracts.update.input>
    }) => callWithOrg(organizationContracts.update, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateOrganization', { variables, data })
    },
  })
}

export function useOrgMembers(id: string) {
  const callWithOrg = useCall()
  return useQuery(orgMembersQueryOptions(id, callWithOrg))
}

export function useUpdateOrgMember() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      userId,
      input,
    }: {
      id: string
      userId: string
      input: z.infer<typeof organizationContracts.updateMember.input>
    }) =>
      callWithOrg(organizationContracts.updateMember, {
        params: { id, userId },
        input,
      }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateOrgMember', { variables, data })
    },
  })
}

export function useRemoveOrgMember() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      callWithOrg(organizationContracts.removeMember, { params: { id, userId } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useRemoveOrgMember', { variables, data })
    },
  })
}

export function useInvites(enabled = true) {
  const callWithOrg = useCall()
  return useQuery(invitesQueryOptions(callWithOrg, enabled))
}

export function useCreateInvite() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof inviteContracts.create.input>) =>
      callWithOrg(inviteContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateInvite', { variables, data })
    },
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(inviteContracts.revoke, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useRevokeInvite', { variables, data })
    },
  })
}

export function useInvitePreview(token: string) {
  const callWithOrg = useCall()
  return useQuery(invitePreviewQueryOptions(token, callWithOrg))
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof inviteContracts.accept.input>) =>
      callWithOrg(inviteContracts.accept, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useAcceptInvite', { variables, data })
    },
  })
}
