/**
 * Freeze / unfreeze / close under lock:card:{id}. CLOSED is terminal.
 */
import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { AirwallexError } from '@/server/airwallex/errors'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys } from '@/server/redis'
import { findCardById, updateCardStatus } from '@/server/repositories/cards'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { Card } from '@/shared/types/card'

const LOCK_TTL_MS = 10_000
const LOCK_RETRY_MS = 15
const LOCK_MAX_WAIT_MS = 2_000

export type LifecycleDeps = {
  airwallex?: AirwallexClient
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withCardLock<T>(cardId: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  const key = redisKeys.lockCard(cardId)
  const token = randomUUID()
  const deadline = Date.now() + LOCK_MAX_WAIT_MS

  while (Date.now() < deadline) {
    const acquired = await redis.set(key, token, { nx: true, px: LOCK_TTL_MS })
    if (acquired) {
      try {
        return await fn()
      } finally {
        const current = await redis.get(key)
        if (current === token) {
          await redis.del(key)
        }
      }
    }
    await sleep(LOCK_RETRY_MS)
  }

  throw AppError.conflict('Card is locked; try again')
}

async function pushStatus(
  ctx: OrgContext,
  card: Card,
  next: 'ACTIVE' | 'INACTIVE' | 'CLOSED',
  deps: LifecycleDeps,
): Promise<Card> {
  return withCardLock(card.id, async () => {
    const fresh = await findCardById(ctx, card.id)
    if (!fresh) {
      throw AppError.notFound()
    }
    if (fresh.status === CardStatus.CLOSED) {
      throw AppError.conflict('Card is CLOSED')
    }

    const client = deps.airwallex ?? getAirwallexClient()
    try {
      await client.cards.update(fresh.airwallexCardId, { card_status: next })
    } catch (error) {
      if (error instanceof AirwallexError && error.retryable) {
        throw AppError.upstreamError('Airwallex card status update failed', {
          retryable: true,
          status: error.status,
        })
      }
      throw error
    }

    const updated = await updateCardStatus(ctx, fresh.id, next)
    if (!updated) {
      throw AppError.notFound()
    }

    await audit(ctx, {
      action: 'card.status_changed',
      subjectType: 'card',
      subjectId: updated.id,
      projectId: updated.projectId ?? undefined,
      actorType: ActorType.USER,
      actorId: ctx.userId,
      before: { status: fresh.status },
      after: { status: updated.status },
      metadata: { from: fresh.status, to: updated.status },
    })

    await publishEvent({
      type: DomainEventType.CARD_STATUS_CHANGED,
      orgId: ctx.orgId,
      projectId: updated.projectId ?? undefined,
      subjectType: 'card',
      subjectId: updated.id,
      payload: {
        cardId: updated.id,
        projectId: updated.projectId,
        from: fresh.status,
        to: updated.status,
      },
    })

    return updated
  })
}

export async function freezeCard(
  ctx: OrgContext,
  cardId: string,
  deps: LifecycleDeps = {},
): Promise<Card> {
  await connectDb()
  const card = await findCardById(ctx, cardId)
  if (!card) throw AppError.notFound()
  if (card.status === CardStatus.CLOSED) throw AppError.conflict('Card is CLOSED')
  return pushStatus(ctx, card, 'INACTIVE', deps)
}

export async function unfreezeCard(
  ctx: OrgContext,
  cardId: string,
  deps: LifecycleDeps = {},
): Promise<Card> {
  await connectDb()
  const card = await findCardById(ctx, cardId)
  if (!card) throw AppError.notFound()
  if (card.status === CardStatus.CLOSED) throw AppError.conflict('Card is CLOSED')
  return pushStatus(ctx, card, 'ACTIVE', deps)
}

export async function closeCard(
  ctx: OrgContext,
  cardId: string,
  input: { confirm: true },
  deps: LifecycleDeps = {},
): Promise<Card> {
  await connectDb()
  if (input.confirm !== true) {
    throw AppError.validationFailed({ confirm: ['Must be true'] })
  }
  const card = await findCardById(ctx, cardId)
  if (!card) throw AppError.notFound()
  if (card.status === CardStatus.CLOSED) throw AppError.conflict('Card is already CLOSED')
  return pushStatus(ctx, card, 'CLOSED', deps)
}
