import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { baseOptions, tenantScoped } from '@/server/models/base'

export type ReceiptFileFields = {
  fileId: string
  orgId: string
  transactionId: string
  fileName: string
  contentType: string
  contentBase64: string
  createdAt: Date
  updatedAt: Date
}

const receiptFileSchema = new Schema<ReceiptFileFields, Model<ReceiptFileFields>>(
  {
    fileId: { type: String, required: true },
    orgId: { type: String, required: true, index: true },
    transactionId: { type: String, required: true },
    fileName: { type: String, required: true, maxlength: 255 },
    contentType: { type: String, required: true },
    contentBase64: { type: String, required: true },
  },
  {
    ...baseOptions,
    collection: 'receiptFiles',
  },
)

receiptFileSchema.plugin(tenantScoped)
receiptFileSchema.index({ fileId: 1 }, { unique: true })
receiptFileSchema.index({ orgId: 1, transactionId: 1 })

export type ReceiptFileDoc = HydratedDocument<ReceiptFileFields>
export const ReceiptFileModel = (models.ReceiptFile ??
  model<ReceiptFileFields>('ReceiptFile', receiptFileSchema)) as Model<ReceiptFileFields>
