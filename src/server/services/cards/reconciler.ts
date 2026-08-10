/**
 * Diff desiredControls vs appliedControls and push a minimal Airwallex update
 * under `lock:card:{cardId}`. On 5xx, leave desired intact for retry.
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
import { findCardById, updateAppliedControls } from '@/server/repositories/cards'
import { controlsEqual, toAirwallexControls } from '@/server/services/cards/controls'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { Card } from '@/shared/types/card'
import type { CardControls } from '@/shared/types/cardControls'

const LOCK_TTL_MS = 10_000
const LOCK_RETRY_MS = 15
const LOCK_MAX_WAIT_MS = 2_000

export type ReconcileCardDeps = {
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

function limitsChanged(desired: CardControls, applied: CardControls): boolean {
  return JSON.stringify(desired.transactionLimits) !== JSON.stringify(applied.transactionLimits)
}

/**
 * Build a minimal authorization_controls patch: only fields that differ.
 * Always includes allowed_transaction_count + transaction_limits when any
 * controls field changes (Airwallex requires them when present in create;
 * on update omitted fields are left alone — we only send changed keys).
 */
export function buildControlsPatch(
  desired: CardControls,
  applied: CardControls,
): ReturnType<typeof toAirwallexControls> | null {
  if (controlsEqual(desired, applied)) {
    return null
  }
  // Full mapped desired — Airwallex update is sparse at the top level;
  // authorization_controls object replaces included keys. Sending the full
  // desired mapped controls is correct and avoids partial allowlist wipes.
  return toAirwallexControls(desired)
}

export async function reconcileCard(
  ctx: OrgContext,
  cardId: string,
  deps: ReconcileCardDeps = {},
): Promise<Card> {
  await connectDb()

  return withCardLock(cardId, async () => {
    const card = await findCardById(ctx, cardId)
    if (!card) {
      throw AppError.notFound()
    }
    if (card.status === CardStatus.CLOSED) {
      throw AppError.conflict('Card is CLOSED')
    }

    const patch = buildControlsPatch(card.desiredControls, card.appliedControls)
    if (patch === null) {
      return card
    }

    const client = deps.airwallex ?? getAirwallexClient()
    const limitsDidChange = limitsChanged(card.desiredControls, card.appliedControls)

    try {
      await client.cards.update(card.airwallexCardId, {
        authorization_controls: patch,
      })
    } catch (error) {
      if (error instanceof AirwallexError && error.retryable) {
        // Leave desiredControls intact for the next attempt.
        throw AppError.upstreamError('Airwallex card update failed', {
          retryable: true,
          status: error.status,
          code: error.code,
        })
      }
      throw error
    }

    const updated = await updateAppliedControls(ctx, cardId, card.desiredControls)
    if (!updated) {
      throw AppError.notFound()
    }

    if (limitsDidChange) {
      await publishEvent({
        type: DomainEventType.CARD_LIMIT_UPDATED,
        orgId: ctx.orgId,
        projectId: updated.projectId ?? undefined,
        subjectType: 'card',
        subjectId: updated.id,
        payload: {
          cardId: updated.id,
          projectId: updated.projectId,
        },
      })
    }

    return updated
  })
}
