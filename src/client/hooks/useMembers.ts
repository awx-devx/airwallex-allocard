'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type AccessReviewFilter } from '@/client/queryKeys'
import { accessReviewContracts } from '@/shared/contracts/accessReview'
import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { roleContracts } from '@/shared/contracts/role'

export function projectMembersQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.projectMembers(id),
    queryFn: () => callWithOrg(projectMemberContracts.list, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function accessHistoryQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.accessHistory(id),
    queryFn: () => callWithOrg(projectMemberContracts.accessHistory, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function rolesQueryOptions(callWithOrg: ContractCaller) {
  return {
    queryKey: qk.roles(),
    queryFn: () => callWithOrg(roleContracts.list),
  }
}

export function accessReviewsQueryOptions(
  filter: AccessReviewFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.accessReviews(filter),
    queryFn: () => callWithOrg(accessReviewContracts.list, { input: filter }),
  }
}

export function useProjectMembers(id: string) {
  const callWithOrg = useCall()
  return useQuery(projectMembersQueryOptions(id, callWithOrg))
}

export function useAddMember() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof projectMemberContracts.add.input>
    }) => callWithOrg(projectMemberContracts.add, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useAddMember', { variables, data })
    },
  })
}

export function useUpdateMember() {
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
      input: z.infer<typeof projectMemberContracts.update.input>
    }) => callWithOrg(projectMemberContracts.update, { params: { id, userId }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateMember', { variables, data })
    },
  })
}

export function useRemoveMember() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      callWithOrg(projectMemberContracts.remove, { params: { id, userId } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useRemoveMember', { variables, data })
    },
  })
}

export function usePreviewMember() {
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof projectMemberContracts.preview.input>
    }) => callWithOrg(projectMemberContracts.preview, { params: { id }, input }),
  })
}

export function useAccessHistory(id: string) {
  const callWithOrg = useCall()
  return useQuery(accessHistoryQueryOptions(id, callWithOrg))
}

export function useRoles() {
  const callWithOrg = useCall()
  return useQuery(rolesQueryOptions(callWithOrg))
}

export function useCreateRole() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof roleContracts.create.input>) =>
      callWithOrg(roleContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateRole', { variables, data })
    },
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof roleContracts.update.input>
    }) => callWithOrg(roleContracts.update, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateRole', { variables, data })
    },
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(roleContracts.delete, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDeleteRole', { variables, data })
    },
  })
}

export function useAccessReviews(filter?: AccessReviewFilter) {
  const callWithOrg = useCall()
  return useQuery(accessReviewsQueryOptions(filter, callWithOrg))
}

export function useResolveAccessReview() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof accessReviewContracts.resolve.input>
    }) => callWithOrg(accessReviewContracts.resolve, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useResolveAccessReview', { variables, data })
    },
  })
}
