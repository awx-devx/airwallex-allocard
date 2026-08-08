import { ActorType } from '@/shared/enums/audit'
import type { SignUpInput } from '@/shared/types/user'
import type { User } from '@/shared/types/user'
import { hashPassword } from '@/server/auth/password'
import { AppError } from '@/server/http/errors'
import { audit } from '@/server/services/audit/log'
import { connectDb } from '@/server/db/connect'
import { createUser, findUserByEmail } from '@/server/repositories/users'
import { getRedis, redisKeys } from '@/server/redis'

/** Audit rows for pre-org actions (sign-up) live under this sentinel org id. */
export const PLATFORM_ORG_ID = '_platform'

const SIGN_UP_RATE_LIMIT = 10
const SIGN_UP_WINDOW_MS = 60 * 60 * 1000

const NEUTRAL_SIGN_UP_ERROR = 'Unable to complete sign-up'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

async function assertSignUpRateLimit(ip: string): Promise<void> {
  const redis = getRedis()
  const key = redisKeys.rateSignUp(ip)
  // Establish TTL on first hit, then increment.
  await redis.set(key, '0', { nx: true, px: SIGN_UP_WINDOW_MS })
  const count = await redis.incr(key)
  if (count > SIGN_UP_RATE_LIMIT) {
    throw AppError.rateLimited('Too many sign-up attempts. Try again later.')
  }
}

export type SignUpMeta = {
  ip: string
}

/**
 * Create a credentials user. Does not create an organisation.
 * Duplicate emails return a neutral conflict (no account-existence leak).
 */
export async function signUp(input: SignUpInput, meta: SignUpMeta): Promise<User> {
  await assertSignUpRateLimit(meta.ip)
  await connectDb()

  const existing = await findUserByEmail(input.email)
  if (existing) {
    throw AppError.conflict(NEUTRAL_SIGN_UP_ERROR)
  }

  const passwordHash = await hashPassword(input.password)

  let user: User
  try {
    user = await createUser({
      email: input.email,
      name: input.name,
      passwordHash,
    })
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict(NEUTRAL_SIGN_UP_ERROR)
    }
    throw error
  }

  await audit(
    { orgId: PLATFORM_ORG_ID, userId: user.id, orgRole: 'MEMBER' },
    {
      action: 'user.signed_up',
      subjectType: 'user',
      subjectId: user.id,
      actorType: ActorType.USER,
      actorId: user.id,
      after: user,
    },
  )

  return user
}
