/**
 * B8.8 — Receipt upload/delete service.
 * Stores receipt content in a simple ReceiptFile collection keyed by random UUID.
 * Sets `receiptFileId` on the Transaction document.
 */
import { randomUUID } from 'crypto'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { ReceiptFileModel } from '@/server/models/ReceiptFile'
import { findTransactionById, updateReceipt } from '@/server/repositories/transactions'
import { audit } from '@/server/services/audit/log'
import type { Transaction, UploadReceiptInput } from '@/shared/types/transaction'

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024 // 10 MB base64

export async function uploadReceipt(
  ctx: OrgContext,
  transactionId: string,
  input: UploadReceiptInput,
): Promise<Transaction> {
  await connectDb()

  if (input.contentBase64.length > MAX_RECEIPT_BYTES) {
    throw AppError.validationFailed({ contentBase64: ['File too large (max 10MB)'] })
  }

  const transaction = await findTransactionById(ctx, transactionId)
  if (!transaction) {
    throw AppError.notFound()
  }

  const fileId = randomUUID()
  await ReceiptFileModel.create({
    fileId,
    orgId: ctx.orgId,
    transactionId,
    fileName: input.fileName,
    contentType: input.contentType,
    contentBase64: input.contentBase64,
  })

  const updated = await updateReceipt(ctx, transactionId, { receiptFileId: fileId })
  if (!updated) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'transaction.receipt_uploaded',
    subjectType: 'transaction',
    subjectId: transactionId,
    projectId: transaction.projectId,
    after: { fileId, fileName: input.fileName },
  })

  return updated
}

export async function deleteReceipt(ctx: OrgContext, transactionId: string): Promise<void> {
  await connectDb()

  const transaction = await findTransactionById(ctx, transactionId)
  if (!transaction) {
    throw AppError.notFound()
  }

  if (transaction.receiptFileId) {
    await ReceiptFileModel.deleteOne({ fileId: transaction.receiptFileId, orgId: ctx.orgId }).exec()
  }

  await updateReceipt(ctx, transactionId, { receiptFileId: null })

  await audit(ctx, {
    action: 'transaction.receipt_deleted',
    subjectType: 'transaction',
    subjectId: transactionId,
    projectId: transaction.projectId,
    before: { fileId: transaction.receiptFileId },
  })
}

/**
 * Missing-receipt sweep: find CLEARED transactions above a threshold that
 * lack a receipt. Returns the list of flagged transaction ids.
 * No OCR — just identification.
 */
export async function sweepMissingReceipts(
  ctx: OrgContext,
  thresholdMinorUnits = 5000,
): Promise<string[]> {
  await connectDb()
  const { TransactionModel } = await import('@/server/models/Transaction')
  const docs = await TransactionModel.find({
    orgId: ctx.orgId,
    status: 'CLEARED',
    receiptFileId: null,
    amount: { $gte: thresholdMinorUnits },
  })
    .select('_id')
    .lean()
    .exec()
  return docs.map((d) => String(d._id))
}
