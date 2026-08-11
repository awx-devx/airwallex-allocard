'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import { approvalCountQueryOptions } from '@/client/hooks/queryDefaults'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type RequestFilter } from '@/client/queryKeys'
import { approvalRuleContracts } from '@/shared/contracts/approvalRule'
import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import type { ListApprovalsQuery } from '@/shared/types/purchaseRequest'

function projectRequestsQueryKey(projectId: string, filter?: RequestFilter) {
  return [...qk.project(projectId), 'requests', filter ?? {}] as const
}

export function requestsQueryOptions(
  projectId: string,
  filter: RequestFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: projectRequestsQueryKey(projectId, filter),
    queryFn: () =>
      callWithOrg(purchaseRequestContracts.list, { params: { id: projectId }, input: filter }),
    enabled: Boolean(projectId),
  }
}

export function requestQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.request(id),
    queryFn: () => callWithOrg(purchaseRequestContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function approvalsQueryOptions(
  filter: ListApprovalsQuery | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.approvals(),
    queryFn: () => callWithOrg(purchaseRequestContracts.listApprovals, { input: filter }),
  }
}

export function approvalCountQueryOptionsFactory(callWithOrg: ContractCaller) {
  return {
    queryKey: qk.approvalCount(),
    queryFn: () => callWithOrg(purchaseRequestContracts.approvalsCount),
    ...approvalCountQueryOptions,
  }
}

export function approvalRulesQueryOptions(projectId: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.approvalRules(projectId),
    queryFn: () => callWithOrg(approvalRuleContracts.list, { params: { id: projectId } }),
    enabled: Boolean(projectId),
  }
}

export function usePolicyPreview() {
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof purchaseRequestContracts.policyPreview.input>) =>
      callWithOrg(purchaseRequestContracts.policyPreview, { input }),
  })
}

export function useRequests(projectId: string, filter?: RequestFilter) {
  const callWithOrg = useCall()
  return useQuery(requestsQueryOptions(projectId, filter, callWithOrg))
}

export function useRequest(id: string) {
  const callWithOrg = useCall()
  return useQuery(requestQueryOptions(id, callWithOrg))
}

export function useCreateRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof purchaseRequestContracts.create.input>
    }) => callWithOrg(purchaseRequestContracts.create, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateRequest', { variables, data })
    },
  })
}

export function useUpdateRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof purchaseRequestContracts.update.input>
    }) => callWithOrg(purchaseRequestContracts.update, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateRequest', { variables, data })
    },
  })
}

export function useSubmitRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      callWithOrg(purchaseRequestContracts.submit, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useSubmitRequest', { variables, data })
    },
  })
}

export function useCancelRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      callWithOrg(purchaseRequestContracts.cancel, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCancelRequest', { variables, data })
    },
  })
}

export function useDecideRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof purchaseRequestContracts.decide.input>
    }) => callWithOrg(purchaseRequestContracts.decide, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDecideRequest', { variables, data })
    },
  })
}

export function useApprovals(filter?: ListApprovalsQuery) {
  const callWithOrg = useCall()
  return useQuery(approvalsQueryOptions(filter, callWithOrg))
}

export function useApprovalCount() {
  const callWithOrg = useCall()
  return useQuery(approvalCountQueryOptionsFactory(callWithOrg))
}

export function useApprovalRules(projectId: string) {
  const callWithOrg = useCall()
  return useQuery(approvalRulesQueryOptions(projectId, callWithOrg))
}

export function usePutApprovalRules() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof approvalRuleContracts.put.input>
    }) => callWithOrg(approvalRuleContracts.put, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'usePutApprovalRules', { variables, data })
    },
  })
}
