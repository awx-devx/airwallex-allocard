import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  listCardTransactionsQuery,
  listDeclinedTransactionsQuery,
  listProjectTransactionsQuery,
  listTransactionsQuery,
  transactionDetailSchema,
  transactionListSchema,
  transactionSchema,
  uploadReceiptInput,
} from '@/shared/schemas/transaction'

export const transactionContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/transactions',
    input: listTransactionsQuery,
    output: transactionListSchema,
  }),
  listForProject: defineContract({
    method: 'GET',
    path: '/api/projects/:id/transactions',
    input: listProjectTransactionsQuery,
    output: transactionListSchema,
  }),
  listForCard: defineContract({
    method: 'GET',
    path: '/api/cards/:id/transactions',
    input: listCardTransactionsQuery,
    output: transactionListSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/transactions/:id',
    input: z.void(),
    output: transactionDetailSchema,
  }),
  listDeclined: defineContract({
    method: 'GET',
    path: '/api/transactions/declined',
    input: listDeclinedTransactionsQuery,
    output: transactionListSchema,
  }),
  uploadReceipt: defineContract({
    method: 'POST',
    path: '/api/transactions/:id/receipt',
    input: uploadReceiptInput,
    output: transactionSchema,
  }),
  deleteReceipt: defineContract({
    method: 'DELETE',
    path: '/api/transactions/:id/receipt',
    input: z.void(),
    output: z.void(),
  }),
  syncAdmin: defineContract({
    method: 'POST',
    path: '/api/admin/sync-transactions',
    input: z.void(),
    output: z.void(),
  }),
} as const

export type TransactionContracts = typeof transactionContracts
