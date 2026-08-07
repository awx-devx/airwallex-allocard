/**
 * Auth.js adapter backed by our Mongoose `User` + `Account` models.
 *
 * The stock `@auth/mongodb-adapter` writes Auth.js's user shape into `users`,
 * which conflicts with our strict User schema (`passwordHash`, no `emailVerified`).
 * This adapter maps to Allocard's identity models instead.
 *
 * JWT session strategy — session collection methods are intentionally omitted.
 */
import type { Adapter, AdapterAccount, AdapterUser } from 'next-auth/adapters'
import { isValidObjectId } from 'mongoose'
import { AccountModel } from '@/server/models/Account'
import { UserModel } from '@/server/models/User'
import { toDomain } from '@/server/models/base'
import { connectDb } from '@/server/db/connect'

function toAdapterUser(doc: Parameters<typeof toDomain>[0]): AdapterUser {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    email: String(raw.email),
    emailVerified: null,
    name: typeof raw.name === 'string' ? raw.name : null,
    image: typeof raw.image === 'string' ? raw.image : null,
  }
}

export function createMongooseAdapter(): Adapter {
  return {
    async createUser(data) {
      await connectDb()
      const doc = await UserModel.create({
        email: data.email,
        name: data.name ?? data.email.split('@')[0] ?? 'User',
        ...(data.image ? { image: data.image } : {}),
      })
      return toAdapterUser(doc)
    },

    async getUser(id) {
      await connectDb()
      if (!isValidObjectId(id)) {
        return null
      }
      const doc = await UserModel.findById(id).lean().exec()
      return doc ? toAdapterUser(doc) : null
    },

    async getUserByEmail(email) {
      await connectDb()
      const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean().exec()
      return doc ? toAdapterUser(doc) : null
    },

    async getUserByAccount({ provider, providerAccountId }) {
      await connectDb()
      const account = await AccountModel.findOne({ provider, providerAccountId }).lean().exec()
      if (!account) {
        return null
      }
      const doc = await UserModel.findById(account.userId).lean().exec()
      return doc ? toAdapterUser(doc) : null
    },

    async updateUser(data) {
      await connectDb()
      const $set: Record<string, unknown> = {}
      if (data.name != null) $set.name = data.name
      if (data.image !== undefined) {
        if (data.image === null) {
          // leave image clearing to explicit null via $unset if needed
        } else {
          $set.image = data.image
        }
      }
      if (data.email != null) $set.email = data.email.toLowerCase()

      const doc = await UserModel.findByIdAndUpdate(
        data.id,
        Object.keys($set).length > 0 ? { $set } : {},
        { returnDocument: 'after' },
      )
        .lean()
        .exec()

      if (!doc) {
        throw new Error(`User ${data.id} not found`)
      }
      return toAdapterUser(doc)
    },

    async linkAccount(account) {
      await connectDb()
      await AccountModel.create({
        userId: account.userId,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token ?? undefined,
        access_token: account.access_token ?? undefined,
        expires_at: account.expires_at ?? undefined,
        token_type: account.token_type ?? undefined,
        scope: account.scope ?? undefined,
        id_token: account.id_token ?? undefined,
        session_state:
          typeof account.session_state === 'string' ? account.session_state : undefined,
      })
      return account
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await connectDb()
      await AccountModel.deleteOne({ provider, providerAccountId }).exec()
    },

    async getAccount(providerAccountId, provider) {
      await connectDb()
      const doc = await AccountModel.findOne({ provider, providerAccountId }).lean().exec()
      if (!doc) {
        return null
      }
      const raw = toDomain<Record<string, unknown>>(doc)
      const account: AdapterAccount = {
        userId: String(raw.userId),
        type: raw.type as AdapterAccount['type'],
        provider: String(raw.provider),
        providerAccountId: String(raw.providerAccountId),
        ...(typeof raw.refresh_token === 'string' ? { refresh_token: raw.refresh_token } : {}),
        ...(typeof raw.access_token === 'string' ? { access_token: raw.access_token } : {}),
        ...(typeof raw.expires_at === 'number' ? { expires_at: raw.expires_at } : {}),
        ...(typeof raw.token_type === 'string'
          ? { token_type: raw.token_type.toLowerCase() as Lowercase<string> }
          : {}),
        ...(typeof raw.scope === 'string' ? { scope: raw.scope } : {}),
        ...(typeof raw.id_token === 'string' ? { id_token: raw.id_token } : {}),
        ...(typeof raw.session_state === 'string' ? { session_state: raw.session_state } : {}),
      }
      return account
    },
  }
}
