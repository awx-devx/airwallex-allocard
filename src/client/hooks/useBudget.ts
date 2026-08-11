'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type EntryFilter } from '@/client/queryKeys'
import { budgetContracts } from '@/shared/contracts/budget'

export function budgetQueryOptions(projectId: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.budget(projectId),
    queryFn: () => callWithOrg(budgetContracts.get, { params: { id: projectId } }),
    enabled: Boolean(projectId),
  }
}

export function budgetCategoriesQueryOptions(projectId: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.budgetCategories(projectId),
    queryFn: () => callWithOrg(budgetContracts.listCategories, { params: { id: projectId } }),
    enabled: Boolean(projectId),
  }
}

export function budgetEntriesQueryOptions(
  projectId: string,
  filter: EntryFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.budgetEntries(projectId, filter),
    queryFn: () =>
      callWithOrg(budgetContracts.listEntries, { params: { id: projectId }, input: filter }),
    enabled: Boolean(projectId),
  }
}

export function budgetHistoryQueryOptions(projectId: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.budgetHistory(projectId),
    queryFn: () => callWithOrg(budgetContracts.history, { params: { id: projectId } }),
    enabled: Boolean(projectId),
  }
}

export function budgetChangeRequestsQueryOptions(projectId: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.budgetChangeRequests(projectId),
    queryFn: () => callWithOrg(budgetContracts.listChangeRequests, { params: { id: projectId } }),
    enabled: Boolean(projectId),
  }
}

export function useBudget(projectId: string) {
  const callWithOrg = useCall()
  return useQuery(budgetQueryOptions(projectId, callWithOrg))
}

export function useSetBudget() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: z.infer<typeof budgetContracts.put.input> }) =>
      callWithOrg(budgetContracts.put, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useSetBudget', { variables, data })
    },
  })
}

export function useBudgetCategories(projectId: string) {
  const callWithOrg = useCall()
  return useQuery(budgetCategoriesQueryOptions(projectId, callWithOrg))
}

export function useCreateBudgetCategory() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof budgetContracts.createCategory.input>
    }) => callWithOrg(budgetContracts.createCategory, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateBudgetCategory', { variables, data })
    },
  })
}

export function useUpdateBudgetCategory() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      catId,
      input,
    }: {
      id: string
      catId: string
      input: z.infer<typeof budgetContracts.updateCategory.input>
    }) => callWithOrg(budgetContracts.updateCategory, { params: { id, catId }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateBudgetCategory', { variables, data })
    },
  })
}

export function useDeleteBudgetCategory() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id, catId }: { id: string; catId: string }) =>
      callWithOrg(budgetContracts.deleteCategory, { params: { id, catId } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDeleteBudgetCategory', { variables, data })
    },
  })
}

export function useBudgetEntries(projectId: string, filter?: EntryFilter) {
  const callWithOrg = useCall()
  return useQuery(budgetEntriesQueryOptions(projectId, filter, callWithOrg))
}

export function useCreateBudgetEntry() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof budgetContracts.createEntry.input>
    }) => callWithOrg(budgetContracts.createEntry, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateBudgetEntry', { variables, data })
    },
  })
}

export function useBudgetHistory(projectId: string) {
  const callWithOrg = useCall()
  return useQuery(budgetHistoryQueryOptions(projectId, callWithOrg))
}

export function useBudgetChangeRequests(projectId: string) {
  const callWithOrg = useCall()
  return useQuery(budgetChangeRequestsQueryOptions(projectId, callWithOrg))
}

export function useCreateChangeRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof budgetContracts.createChangeRequest.input>
    }) => callWithOrg(budgetContracts.createChangeRequest, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateChangeRequest', { variables, data })
    },
  })
}

export function useDecideChangeRequest() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof budgetContracts.decideChangeRequest.input>
    }) => callWithOrg(budgetContracts.decideChangeRequest, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDecideChangeRequest', { variables, data })
    },
  })
}

export function useValidateFormula() {
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof budgetContracts.validateFormula.input>) =>
      callWithOrg(budgetContracts.validateFormula, { input }),
  })
}
