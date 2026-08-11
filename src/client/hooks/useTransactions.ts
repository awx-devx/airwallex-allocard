'use client'

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import type { z } from 'zod'
import { invalidateFor } from '@/client/hooks/invalidationMap'
import type { ContractCaller } from '@/client/hooks/useSession'
import { useCall } from '@/client/hooks/useCall'
import { qk, type DeclinedTxFilter, type TxFilter } from '@/client/queryKeys'
import { transactionContracts } from '@/shared/contracts/transaction'
import type {
  ListCardTransactionsQuery,
  ListProjectTransactionsQuery,
} from '@/shared/types/transaction'

type TransactionDetail = z.infer<typeof transactionContracts.get.output>
type TransactionList = z.infer<typeof transactionContracts.list.output>

function txPageNextParam(last: TransactionList): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined
}

export function transactionsInfiniteQueryOptions(
  filter: TxFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.transactions(filter),
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      callWithOrg(transactionContracts.list, {
        input: { ...filter, page: pageParam } as z.infer<typeof transactionContracts.list.input>,
      }),
    getNextPageParam: txPageNextParam,
  }
}

export function projectTransactionsInfiniteQueryOptions(
  projectId: string,
  filter: ListProjectTransactionsQuery | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: [...qk.project(projectId), 'transactions', filter ?? {}] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      callWithOrg(transactionContracts.listForProject, {
        params: { id: projectId },
        input: { ...filter, page: pageParam } as z.infer<
          typeof transactionContracts.listForProject.input
        >,
      }),
    getNextPageParam: txPageNextParam,
    enabled: Boolean(projectId),
  }
}

export function cardTransactionsInfiniteQueryOptions(
  cardId: string,
  filter: ListCardTransactionsQuery | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: [...qk.card(cardId), 'transactions', filter ?? {}] as const,
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      callWithOrg(transactionContracts.listForCard, {
        params: { id: cardId },
        input: { ...filter, page: pageParam } as z.infer<
          typeof transactionContracts.listForCard.input
        >,
      }),
    getNextPageParam: txPageNextParam,
    enabled: Boolean(cardId),
  }
}

export function transactionQueryOptions(id: string, callWithOrg: ContractCaller) {
  return {
    queryKey: qk.transaction(id),
    queryFn: () => callWithOrg(transactionContracts.get, { params: { id } }),
    enabled: Boolean(id),
  }
}

export function declinedTransactionsInfiniteQueryOptions(
  filter: DeclinedTxFilter | undefined,
  callWithOrg: ContractCaller,
) {
  return {
    queryKey: qk.declinedTransactions(filter),
    initialPageParam: 1,
    queryFn: ({ pageParam }: { pageParam: number }) =>
      callWithOrg(transactionContracts.listDeclined, {
        input: { ...filter, page: pageParam } as z.infer<
          typeof transactionContracts.listDeclined.input
        >,
      }),
    getNextPageParam: txPageNextParam,
  }
}

async function optimisticSetReceipt(
  qc: QueryClient,
  id: string,
  receiptFileId: string | null,
): Promise<{ previous: TransactionDetail | undefined }> {
  await qc.cancelQueries({ queryKey: qk.transaction(id) })
  const previous = qc.getQueryData<TransactionDetail>(qk.transaction(id))
  if (previous) {
    qc.setQueryData(qk.transaction(id), { ...previous, receiptFileId })
  }
  return { previous }
}

export function useTransactions(filter?: TxFilter) {
  const callWithOrg = useCall()
  return useInfiniteQuery(transactionsInfiniteQueryOptions(filter, callWithOrg))
}

export function useProjectTransactions(projectId: string, filter?: ListProjectTransactionsQuery) {
  const callWithOrg = useCall()
  return useInfiniteQuery(projectTransactionsInfiniteQueryOptions(projectId, filter, callWithOrg))
}

export function useCardTransactions(cardId: string, filter?: ListCardTransactionsQuery) {
  const callWithOrg = useCall()
  return useInfiniteQuery(cardTransactionsInfiniteQueryOptions(cardId, filter, callWithOrg))
}

export function useTransaction(id: string) {
  const callWithOrg = useCall()
  return useQuery(transactionQueryOptions(id, callWithOrg))
}

export function useDeclinedTransactions(filter?: DeclinedTxFilter) {
  const callWithOrg = useCall()
  return useInfiniteQuery(declinedTransactionsInfiniteQueryOptions(filter, callWithOrg))
}

export function useUploadReceipt() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string
      input: z.infer<typeof transactionContracts.uploadReceipt.input>
    }) => callWithOrg(transactionContracts.uploadReceipt, { params: { id }, input }),
    onMutate: async ({ id }) => optimisticSetReceipt(qc, id, 'optimistic-receipt'),
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(qk.transaction(id), context.previous)
      }
    },
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useUploadReceipt', { variables, data })
    },
  })
}

export function useDeleteReceipt() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      callWithOrg(transactionContracts.deleteReceipt, { params: { id } }),
    onMutate: async ({ id }) => optimisticSetReceipt(qc, id, null),
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        qc.setQueryData(qk.transaction(id), context.previous)
      }
    },
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useDeleteReceipt', { variables, data })
    },
  })
}

export function useSyncTransactionsAdmin() {
  const qc = useQueryClient()
  const callWithOrg = useCall()
  return useMutation({
    mutationFn: () => callWithOrg(transactionContracts.syncAdmin),
    onSettled: (data, error, variables) => {
      if (!error) invalidateFor(qc, 'useSyncTransactionsAdmin', { variables, data })
    },
  })
}

export { txPageNextParam, optimisticSetReceipt }
