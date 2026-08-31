/**
 * Explicit cardholder create (DELEGATE path and admin POST /api/cardholders).
 */
import { connectDb } from '@/server/db/connect'
import type { AirwallexClient } from '@/server/airwallex/client'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findCardholderByUserId,
  findOrgDelegateCardholder,
} from '@/server/repositories/cardholders'
import { findUserById } from '@/server/repositories/users'
import { audit } from '@/server/services/audit/log'
import {
  ensureIndividualCardholder,
  ensureOrgDelegateCardholder,
} from '@/server/services/cardholders/ensure'
import { ActorType } from '@/shared/enums/audit'
import { CardholderType } from '@/shared/enums/cardholderType'
import type { Cardholder, CreateCardholderInput } from '@/shared/types/cardholder'

export type CreateCardholderDeps = {
  airwallex?: AirwallexClient
}

export async function createCardholderForOrg(
  ctx: OrgContext,
  input: CreateCardholderInput,
  deps: CreateCardholderDeps = {},
): Promise<Cardholder> {
  await connectDb()

  if (input.type === CardholderType.INDIVIDUAL) {
    if (!input.userId) {
      throw AppError.validationFailed({ userId: ['userId is required for INDIVIDUAL cardholders'] })
    }
    const existing = await findCardholderByUserId(ctx, input.userId)
    if (existing) {
      return existing
    }
    const cardholder = await ensureIndividualCardholder(ctx, input.userId, deps)
    await audit(ctx, {
      action: 'cardholder.created',
      subjectType: 'cardholder',
      subjectId: cardholder.id,
      actorType: ActorType.USER,
      actorId: ctx.userId,
      after: cardholder,
      metadata: { type: cardholder.type, userId: input.userId },
    })
    return cardholder
  }

  const existingDelegate = await findOrgDelegateCardholder(ctx)
  if (existingDelegate) {
    return existingDelegate
  }
  const cardholder = await ensureOrgDelegateCardholder(ctx, deps)

  await audit(ctx, {
    action: 'cardholder.created',
    subjectType: 'cardholder',
    subjectId: cardholder.id,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: cardholder,
    metadata: { type: cardholder.type },
  })

  return cardholder
}

/** Resolve user display for DELEGATE create paths that optionally bind a user. */
export async function assertUserExists(userId: string): Promise<void> {
  const user = await findUserById(userId)
  if (!user) {
    throw AppError.notFound()
  }
}
