/**
 * Explicit cardholder create (DELEGATE path and admin POST /api/cardholders).
 */
import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { cardholderRequestId } from '@/server/airwallex/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  createCardholder,
  findCardholderByAirwallexId,
  findCardholderByUserId,
  updateCardholderAirwallexId,
  updateCardholderStatus,
} from '@/server/repositories/cardholders'
import { findUserById } from '@/server/repositories/users'
import { audit } from '@/server/services/audit/log'
import { ensureIndividualCardholder } from '@/server/services/cardholders/ensure'
import { ActorType } from '@/shared/enums/audit'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import type { Cardholder, CreateCardholderInput } from '@/shared/types/cardholder'

export type CreateCardholderDeps = {
  airwallex?: AirwallexClient
}

function mapAwStatus(status: string): CardholderStatus {
  switch (status) {
    case 'READY':
      return CardholderStatus.READY
    case 'INCOMPLETE':
      return CardholderStatus.INCOMPLETE
    case 'DISABLED':
      return CardholderStatus.DISABLED
    case 'DELETED':
      return CardholderStatus.DELETED
    case 'PENDING':
    default:
      return CardholderStatus.PENDING
  }
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

  // DELEGATE — no user required
  const provisionalId = `pending:${randomUUID()}`
  let cardholder = await createCardholder(ctx, {
    userId: input.userId ?? null,
    airwallexCardholderId: provisionalId,
    type: CardholderType.DELEGATE,
    status: CardholderStatus.PENDING,
  })

  const client = deps.airwallex ?? getAirwallexClient()
  try {
    const aw = await client.cardholders.create({
      request_id: cardholderRequestId(cardholder.id),
      type: 'DELEGATE',
      metadata: { orgId: ctx.orgId, cardDocId: cardholder.id },
    })
    let awId = aw.cardholder_id
    const clash = await findCardholderByAirwallexId(ctx, awId)
    if (clash && clash.id !== cardholder.id) {
      awId = `${aw.cardholder_id}:${cardholder.id}`
    }
    const withAwId = await updateCardholderAirwallexId(ctx, cardholder.id, awId)
    const withStatus = await updateCardholderStatus(ctx, cardholder.id, mapAwStatus(aw.status))
    cardholder = withStatus ?? withAwId ?? cardholder
  } catch {
    // Persist PENDING local mirror; caller can retry Airwallex later.
  }

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
