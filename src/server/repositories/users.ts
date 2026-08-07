/**
 * Users are global identity records, not tenant-owned.
 * Methods take `userId` / email rather than `OrgContext`.
 */
import { isValidObjectId } from 'mongoose'
import { UserModel } from '@/server/models/User'
import { toDomain } from '@/server/models/base'
import type { User } from '@/shared/types/user'

export type CreateUserInput = {
  email: string
  name: string
  passwordHash?: string
  image?: string
  defaultOrgId?: string
}

export type UpdateUserInput = {
  name?: string
  image?: string | null
  defaultOrgId?: string | null
}

/** Credentials lookup — includes `passwordHash`. Never return this from an API. */
export type UserCredentials = User & { passwordHash: string }

function toUser(doc: Parameters<typeof toDomain>[0]): User {
  const raw = toDomain<Record<string, unknown>>(doc)
  const user: User = {
    id: String(raw.id),
    email: String(raw.email),
    name: String(raw.name),
    createdAt: String(raw.createdAt),
  }
  if (typeof raw.image === 'string' && raw.image.length > 0) {
    user.image = raw.image
  }
  if (typeof raw.defaultOrgId === 'string' && raw.defaultOrgId.length > 0) {
    user.defaultOrgId = raw.defaultOrgId
  }
  return user
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const doc = await UserModel.create({
    email: input.email,
    name: input.name,
    ...(input.passwordHash !== undefined ? { passwordHash: input.passwordHash } : {}),
    ...(input.image !== undefined ? { image: input.image } : {}),
    ...(input.defaultOrgId !== undefined ? { defaultOrgId: input.defaultOrgId } : {}),
  })
  return toUser(doc)
}

export async function findUserById(userId: string): Promise<User | null> {
  if (!isValidObjectId(userId)) {
    return null
  }
  const doc = await UserModel.findById(userId).lean().exec()
  return doc ? toUser(doc) : null
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const doc = await UserModel.findOne({ email: email.toLowerCase() }).lean().exec()
  return doc ? toUser(doc) : null
}

/** For credentials sign-in only — selects `passwordHash`. */
export async function findUserCredentialsByEmail(email: string): Promise<UserCredentials | null> {
  const doc = await UserModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec()
  if (!doc || doc.passwordHash == null) {
    return null
  }
  return { ...toUser(doc), passwordHash: doc.passwordHash }
}

export async function findUsersByIds(userIds: string[]): Promise<User[]> {
  const ids = userIds.filter((id) => isValidObjectId(id))
  if (ids.length === 0) {
    return []
  }
  const docs = await UserModel.find({ _id: { $in: ids } })
    .lean()
    .exec()
  return docs.map((doc) => toUser(doc))
}

export async function updateUser(userId: string, patch: UpdateUserInput): Promise<User | null> {
  if (!isValidObjectId(userId)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  const $unset: Record<string, ''> = {}

  if (patch.name !== undefined) {
    $set.name = patch.name
  }
  if (patch.image !== undefined) {
    if (patch.image === null) {
      $unset.image = ''
    } else {
      $set.image = patch.image
    }
  }
  if (patch.defaultOrgId !== undefined) {
    if (patch.defaultOrgId === null) {
      $unset.defaultOrgId = ''
    } else {
      $set.defaultOrgId = patch.defaultOrgId
    }
  }

  const doc = await UserModel.findByIdAndUpdate(
    userId,
    {
      ...(Object.keys($set).length > 0 ? { $set } : {}),
      ...(Object.keys($unset).length > 0 ? { $unset } : {}),
    },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()

  return doc ? toUser(doc) : null
}
