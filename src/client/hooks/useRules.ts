'use client'

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import {
  attributeValuesQueryOptions,
  ruleRunsInFlightQueryOptions,
} from '@/client/hooks/queryDefaults'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type AttributeValueFilter, type RuleFilter, type RunFilter } from '@/client/queryKeys'
import { attributeContracts } from '@/shared/contracts/attribute'
import { remoteAuthContracts } from '@/shared/contracts/remoteAuth'
import { ruleContracts } from '@/shared/contracts/rule'
import { cardExplainContracts, ruleRunContracts } from '@/shared/contracts/ruleRun'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { ListAttributesQuery } from '@/shared/types/attribute'

function pageNextParam(last: z.infer<typeof ruleRunContracts.list.output>): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined
}

function hasInFlightRuns(
  pages: z.infer<typeof ruleRunContracts.list.output>[] | undefined,
): boolean {
  if (!pages) return false
  return pages.some((page) => page.items.some((run) => run.status === RuleRunStatus.PARTIAL))
}

export function attributesQueryOptions(
  filter: ListAttributesQuery | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.attributes(),
    queryFn: () => callWithOrg(attributeContracts.list, { input: filter }),
  }
}

export function attributeValuesQueryOptionsFactory(
  filter: AttributeValueFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.attributeValues(filter),
    queryFn: () => callWithOrg(attributeContracts.listValues, { input: filter }),
    ...attributeValuesQueryOptions,
  }
}

export function rulesQueryOptions(filter: RuleFilter | undefined, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.rules(filter),
    queryFn: () => callWithOrg(ruleContracts.list, { input: filter }),
  }
}

export function ruleRunsInfiniteQueryOptions(
  filter: RunFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.ruleRuns(filter),
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      callWithOrg(ruleRunContracts.list, {
        input: { ...filter, page: pageParam } as z.infer<typeof ruleRunContracts.list.input>,
      }),
    getNextPageParam: pageNextParam,
  }
}

export function ruleRunQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.ruleRun(id),
    queryFn: () => callWithOrg(ruleRunContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function cardExplainQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.cardExplain(id),
    queryFn: () => callWithOrg(cardExplainContracts.explain, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function useAttributes(filter?: ListAttributesQuery) {
  const callWithOrg = useCall()
  return useQuery(attributesQueryOptions(filter, callWithOrg))
}

export function useCreateAttribute() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof attributeContracts.create.input>) =>
      callWithOrg(attributeContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateAttribute', { variables, data })
    },
  })
}

export function useUpdateAttribute() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      key,
      input,
    }: {
      key: string
      input: z.infer<typeof attributeContracts.update.input>
    }) => callWithOrg(attributeContracts.update, { params: { key }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateAttribute', { variables, data })
    },
  })
}

export function useAttributeValues(filter?: AttributeValueFilter) {
  const callWithOrg = useCall()
  return useQuery(attributeValuesQueryOptionsFactory(filter, callWithOrg))
}

export function useSetAttributeValue() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof attributeContracts.putValue.input>) =>
      callWithOrg(attributeContracts.putValue, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useSetAttributeValue', { variables, data })
    },
  })
}

export function useRules(filter?: RuleFilter) {
  const callWithOrg = useCall()
  return useQuery(rulesQueryOptions(filter, callWithOrg))
}

export function useCreateRule() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof ruleContracts.create.input>) =>
      callWithOrg(ruleContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateRule', { variables, data })
    },
  })
}

export function useUpdateRule() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof ruleContracts.update.input>
    }) => callWithOrg(ruleContracts.update, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateRule', { variables, data })
    },
  })
}

export function useDeleteRule() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(ruleContracts.delete, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDeleteRule', { variables, data })
    },
  })
}

export function useEnableRule() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof ruleContracts.enable.input>
    }) => callWithOrg(ruleContracts.enable, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useEnableRule', { variables, data })
    },
  })
}

export function useValidateRule() {
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof ruleContracts.validate.input>) =>
      callWithOrg(ruleContracts.validate, { input }),
  })
}

export function useSimulateRules() {
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof ruleContracts.simulate.input>) =>
      callWithOrg(ruleContracts.simulate, { input }),
  })
}

export function useSimulatePurchase() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof remoteAuthContracts.simulatePurchase.input>) =>
      callWithOrg(remoteAuthContracts.simulatePurchase, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useSimulatePurchase', { variables, data })
    },
  })
}

export function useRuleRuns(filter?: RunFilter) {
  const callWithOrg = useCall()
  return useInfiniteQuery({
    ...ruleRunsInfiniteQueryOptions(filter, callWithOrg),
    refetchInterval: (query) =>
      hasInFlightRuns(query.state.data?.pages)
        ? ruleRunsInFlightQueryOptions.refetchInterval
        : false,
  })
}

export function useRuleRun(id: string) {
  const callWithOrg = useCall()
  return useQuery(ruleRunQueryOptions(id, callWithOrg))
}

export function useCardExplain(id: string) {
  const callWithOrg = useCall()
  return useQuery(cardExplainQueryOptions(id, callWithOrg))
}

export { pageNextParam, hasInFlightRuns }
