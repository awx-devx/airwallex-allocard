import { Schema, model, models, type HydratedDocument, type Model } from 'mongoose'
import { baseOptionsOmitting } from '@/server/models/base'

/**
 * Storage shape. `passwordHash` is never part of the public `User` domain type —
 * `select: false` + transform omit keep it off the wire.
 */
export type UserFields = {
  email: string
  name: string
  image?: string
  passwordHash?: string
  defaultOrgId?: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<UserFields, Model<UserFields>>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    image: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    defaultOrgId: { type: String },
  },
  {
    ...baseOptionsOmitting(['passwordHash']),
    collection: 'users',
  },
)

export type UserDoc = HydratedDocument<UserFields>
export const UserModel = (models.User ?? model<UserFields>('User', userSchema)) as Model<UserFields>
