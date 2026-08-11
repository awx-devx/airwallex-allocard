/**
 * Transactions are tenant-owned. Every method takes `OrgContext` first.
 * Cross-org lookups return null (never leak existence via 403).
 */
import { isValidObjectId } from 'mongoose'
import { TransactionModel } from '@/server/models/Transaction'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { TransactionStatus } from '@/shared/enums/transactionStatus'
import type { TransactionType } from '@/shared/enums/transactionType'
import type { Transaction, TransactionList, TransactionMerchant } from '@/shared/types/transaction'

export type CreateTransactionInput = {
  cardId: string
  projectId: string
  airwallexTransactionId: string
  cardTransactionId: string
  lifecycleId: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: string
  billingAmount: number
  billingCurrency: string
  merchant: TransactionMerchant
  failureReason?: string | null
  receiptFileId?: string | null
  transactedAt: Date
}

export type ListTransactionsFilter = {
  cardId?: string
  projectId?: string
  status?: TransactionStatus
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

export type UpdateReceiptFields = {
  receiptFileId: string | null
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

function toMerchant(raw: Record<string, unknown>): TransactionMerchant {
  return {
    name: String(raw.name),
    mcc: String(raw.mcc),
    country: String(raw.country),
  }
}

function toTransaction(doc: Parameters<typeof toDomain>[0]): Transaction {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    cardId: String(raw.cardId),
    projectId: String(raw.projectId),
    airwallexTransactionId: String(raw.airwallexTransactionId),
    cardTransactionId: String(raw.cardTransactionId),
    lifecycleId: String(raw.lifecycleId),
    type: raw.type as TransactionType,
    status: raw.status as TransactionStatus,
    amount: Number(raw.amount),
    currency: String(raw.currency),
    billingAmount: Number(raw.billingAmount),
    billingCurrency: String(raw.billingCurrency),
    merchant: toMerchant(raw.merchant as Record<string, unknown>),
    failureReason: nullableString(raw.failureReason),
    receiptFileId: nullableString(raw.receiptFileId),
    transactedAt: String(raw.transactedAt),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function createTransaction(
  ctx: OrgContext,
  input: CreateTransactionInput,
): Promise<Transaction> {
  const doc = await TransactionModel.create({
    orgId: ctx.orgId,
    cardId: input.cardId,
    projectId: input.projectId,
    airwallexTransactionId: input.airwallexTransactionId,
    cardTransactionId: input.cardTransactionId,
    lifecycleId: input.lifecycleId,
    type: input.type,
    status: input.status,
    amount: input.amount,
    currency: input.currency,
    billingAmount: input.billingAmount,
    billingCurrency: input.billingCurrency,
    merchant: input.merchant,
    failureReason: input.failureReason === undefined ? null : input.failureReason,
    receiptFileId: input.receiptFileId === undefined ? null : input.receiptFileId,
    transactedAt: input.transactedAt,
  })
  return toTransaction(doc)
}

export async function findTransactionById(
  ctx: OrgContext,
  id: string,
): Promise<Transaction | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await TransactionModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toTransaction(doc) : null
}

export async function findByAirwallexTransactionId(
  ctx: OrgContext,
  airwallexTransactionId: string,
): Promise<Transaction | null> {
  const doc = await TransactionModel.findOne({
    orgId: ctx.orgId,
    airwallexTransactionId,
  })
    .lean()
    .exec()
  return doc ? toTransaction(doc) : null
}

export async function findByLifecycleId(
  ctx: OrgContext,
  lifecycleId: string,
): Promise<Transaction[]> {
  const docs = await TransactionModel.find({ orgId: ctx.orgId, lifecycleId })
    .sort({ transactedAt: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toTransaction(doc))
}

export async function listTransactions(
  ctx: OrgContext,
  filter: ListTransactionsFilter = {},
): Promise<TransactionList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.cardId !== undefined) query.cardId = filter.cardId
  if (filter.projectId !== undefined) query.projectId = filter.projectId
  if (filter.status !== undefined) query.status = filter.status
  if (filter.from !== undefined || filter.to !== undefined) {
    const transactedAt: Record<string, Date> = {}
    if (filter.from !== undefined) transactedAt.$gte = filter.from
    if (filter.to !== undefined) transactedAt.$lte = filter.to
    query.transactedAt = transactedAt
  }

  const [total, docs] = await Promise.all([
    TransactionModel.countDocuments(query).exec(),
    TransactionModel.find(query)
      .sort({ transactedAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toTransaction(doc)),
    page,
    pageSize,
    total,
  }
}

export async function updateReceipt(
  ctx: OrgContext,
  id: string,
  fields: UpdateReceiptFields,
): Promise<Transaction | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await TransactionModel.findOneAndUpdate(
    { _id: id, orgId: ctx.orgId },
    { $set: { receiptFileId: fields.receiptFileId } },
    { new: true },
  )
    .lean()
    .exec()
  return doc ? toTransaction(doc) : null
}
