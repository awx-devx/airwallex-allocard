import { z } from 'zod'
import {
  listCardTransactionsQuery,
  listDeclinedTransactionsQuery,
  listProjectTransactionsQuery,
  listTransactionsQuery,
  transactionDetailSchema,
  transactionListSchema,
  transactionMerchantSchema,
  transactionSchema,
  uploadReceiptInput,
} from '@/shared/schemas/transaction'

export type TransactionMerchant = z.infer<typeof transactionMerchantSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type TransactionDetail = z.infer<typeof transactionDetailSchema>
export type TransactionList = z.infer<typeof transactionListSchema>
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuery>
export type ListProjectTransactionsQuery = z.infer<typeof listProjectTransactionsQuery>
export type ListCardTransactionsQuery = z.infer<typeof listCardTransactionsQuery>
export type ListDeclinedTransactionsQuery = z.infer<typeof listDeclinedTransactionsQuery>
export type UploadReceiptInput = z.infer<typeof uploadReceiptInput>
