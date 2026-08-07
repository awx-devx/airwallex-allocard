import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { baseOptions } from '@/server/models/base'

/**
 * OAuth account link for Auth.js. Not tenant-scoped — accounts hang off global users.
 */
export type AccountFields = {
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refresh_token?: string
  access_token?: string
  expires_at?: number
  token_type?: string
  scope?: string
  id_token?: string
  session_state?: string
  createdAt: Date
  updatedAt: Date
}

const accountSchema = new Schema<AccountFields, Model<AccountFields>>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, required: true },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    refresh_token: { type: String },
    access_token: { type: String },
    expires_at: { type: Number },
    token_type: { type: String },
    scope: { type: String },
    id_token: { type: String },
    session_state: { type: String },
  },
  {
    ...baseOptions,
    collection: 'accounts',
  },
)

accountSchema.index({ provider: 1, providerAccountId: 1 }, { unique: true })

export type AccountDoc = HydratedDocument<AccountFields>
export const AccountModel = (models.Account ??
  model<AccountFields>('Account', accountSchema)) as Model<AccountFields>
