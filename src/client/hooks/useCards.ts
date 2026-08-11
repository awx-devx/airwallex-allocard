'use client'

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import { cardLimitsQueryOptions } from '@/client/hooks/queryDefaults'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import {
  qk,
  type CardFilter,
  type CardholderFilter,
  type ProjectCardFilter,
} from '@/client/queryKeys'
import { cardContracts } from '@/shared/contracts/card'
import { cardholderContracts } from '@/shared/contracts/cardholder'
import { CardStatus } from '@/shared/enums/cardStatus'

type Card = z.infer<typeof cardContracts.get.output>
type CardList = z.infer<typeof cardContracts.list.output>

function patchCardStatus(card: Card, status: Card['status']): Card {
  return { ...card, status }
}

function patchCardInList(list: CardList, cardId: string, status: Card['status']): CardList {
  return {
    ...list,
    items: list.items.map((c) => (c.id === cardId ? patchCardStatus(c, status) : c)),
  }
}

async function optimisticSetCardStatus(
  qc: QueryClient,
  cardId: string,
  status: Card['status'],
): Promise<{ previousCard: Card | undefined; previousLists: [readonly unknown[], CardList][] }> {
  await qc.cancelQueries({ queryKey: qk.card(cardId) })
  await qc.cancelQueries({ queryKey: qk.cards() })

  const previousCard = qc.getQueryData<Card>(qk.card(cardId))
  if (previousCard) {
    qc.setQueryData(qk.card(cardId), patchCardStatus(previousCard, status))
  }

  const previousLists: [readonly unknown[], CardList][] = []
  qc.getQueriesData<CardList>({ queryKey: qk.cards() }).forEach(([key, data]) => {
    if (data) {
      previousLists.push([key, data])
      qc.setQueryData(key, patchCardInList(data, cardId, status))
    }
  })

  return { previousCard, previousLists }
}

function rollbackCardStatus(
  qc: QueryClient,
  cardId: string,
  previousCard: Card | undefined,
  previousLists: [readonly unknown[], CardList][],
): void {
  if (previousCard) {
    qc.setQueryData(qk.card(cardId), previousCard)
  }
  for (const [key, data] of previousLists) {
    qc.setQueryData(key, data)
  }
}

export function cardsQueryOptions(filter: CardFilter | undefined, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.cards(filter),
    queryFn: () => callWithOrg(cardContracts.list, { input: filter }),
  }
}

export function projectCardsQueryOptions(
  projectId: string,
  filter: ProjectCardFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.cardsForProject(projectId, filter),
    queryFn: () =>
      callWithOrg(cardContracts.listForProject, { params: { id: projectId }, input: filter }),
    enabled: Boolean(projectId),
  }
}

export function cardQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.card(id),
    queryFn: () => callWithOrg(cardContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function cardLimitsQueryOptionsFactory(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.cardLimits(id),
    queryFn: () => callWithOrg(cardContracts.limits, { params: { id } }),
    enabled: Boolean(id),
    ...cardLimitsQueryOptions,
  }
}

export function cardholdersQueryOptions(
  filter: CardholderFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.cardholders(filter),
    queryFn: () => callWithOrg(cardholderContracts.list, { input: filter }),
  }
}

export function cardholderQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.cardholder(id),
    queryFn: () => callWithOrg(cardholderContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function useCards(filter?: CardFilter) {
  const callWithOrg = useCall()
  return useQuery(cardsQueryOptions(filter, callWithOrg))
}

export function useProjectCards(projectId: string, filter?: ProjectCardFilter) {
  const callWithOrg = useCall()
  return useQuery(projectCardsQueryOptions(projectId, filter, callWithOrg))
}

export function useCard(id: string) {
  const callWithOrg = useCall()
  return useQuery(cardQueryOptions(id, callWithOrg))
}

export function useCreateCard() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof cardContracts.create.input>
    }) => callWithOrg(cardContracts.create, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateCard', { variables, data })
    },
  })
}

export function useUpdateCard() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof cardContracts.update.input>
    }) => callWithOrg(cardContracts.update, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUpdateCard', { variables, data })
    },
  })
}

export function useFreezeCard() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(cardContracts.freeze, { params: { id } }),
    onMutate: async ({ id }) => optimisticSetCardStatus(qc, id, CardStatus.INACTIVE),
    onError: (_err, { id }, context) => {
      if (context) {
        rollbackCardStatus(qc, id, context.previousCard, context.previousLists)
      }
    },
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useFreezeCard', { variables, data })
    },
  })
}

export function useUnfreezeCard() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(cardContracts.unfreeze, { params: { id } }),
    onMutate: async ({ id }) => optimisticSetCardStatus(qc, id, CardStatus.ACTIVE),
    onError: (_err, { id }, context) => {
      if (context) {
        rollbackCardStatus(qc, id, context.previousCard, context.previousLists)
      }
    },
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUnfreezeCard', { variables, data })
    },
  })
}

export function useCloseCard() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: z.infer<typeof cardContracts.close.input> }) =>
      callWithOrg(cardContracts.close, { params: { id }, input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCloseCard', { variables, data })
    },
  })
}

export function useCardLimits(id: string) {
  const callWithOrg = useCall()
  return useQuery(cardLimitsQueryOptionsFactory(id, callWithOrg))
}

export function usePanToken() {
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) => callWithOrg(cardContracts.panToken, { params: { id } }),
  })
}

export function useReconcileCard() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      callWithOrg(cardContracts.reconcile, { params: { id } }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useReconcileCard', { variables, data })
    },
  })
}

export function useCardholders(filter?: CardholderFilter) {
  const callWithOrg = useCall()
  return useQuery(cardholdersQueryOptions(filter, callWithOrg))
}

export function useCardholder(id: string) {
  const callWithOrg = useCall()
  return useQuery(cardholderQueryOptions(id, callWithOrg))
}

export function useCreateCardholder() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: (input: z.infer<typeof cardholderContracts.create.input>) =>
      callWithOrg(cardholderContracts.create, { input }),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useCreateCardholder', { variables, data })
    },
  })
}

export { optimisticSetCardStatus, rollbackCardStatus }
