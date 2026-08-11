import { z } from 'zod'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

export const transactionMerchantSchema = z.object({
  name: z.string().min(1).max(500),
  /** MCC — typically 4 digits; keep as string for leading zeros. */
  mcc: z.string().min(1).max(8),
  /** ISO 3166-1 alpha-2 (or Airwallex test codes like AWX). */
  country: z.string().min(1).max(3),
})

/**
 * Local transaction / card-transaction-event mirror.
 * Amounts are integer minor units; convert from Airwallex major units at the
 * ingest boundary (same pattern as cards/controls.ts).
 * `lifecycleId` is required so ledger RELEASE can find COMMITMENT.
 */
export const transactionSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  cardId: idSchema,
  projectId: idSchema,
  /** Unique per org with airwallexTransactionId — typically the event id. */
  airwallexTransactionId: z.string().min(1),
  cardTransactionId: z.string().min(1),
  lifecycleId: z.string().min(1),
  type: z.enum(TransactionType),
  status: z.enum(TransactionStatus),
  /** Integer minor units. */
  amount: z.number().int(),
  currency: z.string().length(3),
  /** Integer minor units. */
  billingAmount: z.number().int(),
  billingCurrency: z.string().length(3),
  merchant: transactionMerchantSchema,
  failureReason: z.string().nullable(),
  receiptFileId: idSchema.nullable(),
  transactedAt: isoDateSchema,
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

/** GET /api/transactions/:id — includes full lifecycle event chain. */
export const transactionDetailSchema = transactionSchema.extend({
  lifecycleEvents: z.array(transactionSchema),
})

export const listTransactionsQuery = z.object({
  cardId: idSchema.optional(),
  projectId: idSchema.optional(),
  status: z.enum(TransactionStatus).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Project-scoped list — projectId is in the path. */
export const listProjectTransactionsQuery = z.object({
  status: z.enum(TransactionStatus).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Card-scoped list — cardId is in the path. */
export const listCardTransactionsQuery = z.object({
  status: z.enum(TransactionStatus).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

/** Declined queue — status fixed to DECLINED server-side. */
export const listDeclinedTransactionsQuery = z.object({
  cardId: idSchema.optional(),
  projectId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const transactionListSchema = z.object({
  items: z.array(transactionSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

/**
 * Receipt attach. Multipart may carry the bytes; Zod validates these fields.
 * B8.8 stores content and sets `receiptFileId`.
 */
export const uploadReceiptInput = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  /** Base64-encoded file body; size limits enforced in the handler. */
  contentBase64: z.string().min(1),
})
