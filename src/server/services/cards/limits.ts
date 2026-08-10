import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys } from '@/server/redis'
import { findCardById } from '@/server/repositories/cards'
import { majorToMinor } from '@/server/services/cards/controls'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardLimitsOutput } from '@/shared/types/card'

const CACHE_TTL_MS = 30_000

export type LimitsDeps = {
  airwallex?: AirwallexClient
}

export async function getCardLimits(
  ctx: OrgContext,
  cardId: string,
  deps: LimitsDeps = {},
): Promise<CardLimitsOutput> {
  await connectDb()
  const card = await findCardById(ctx, cardId)
  if (!card) {
    throw AppError.notFound()
  }

  const redis = getRedis()
  const cacheKey = redisKeys.cardLimits(cardId)
  const cached = await redis.get(cacheKey)
  if (cached) {
    return JSON.parse(cached) as CardLimitsOutput
  }

  const client = deps.airwallex ?? getAirwallexClient()
  const aw = await client.cards.limits(card.airwallexCardId)
  const cachedAt = new Date().toISOString()
  const output: CardLimitsOutput = {
    currency: aw.currency,
    limits: aw.limits.map((limit) => ({
      interval: limit.interval as TransactionLimitInterval,
      amount: majorToMinor(limit.amount, aw.currency),
      remaining: majorToMinor(limit.remaining, aw.currency),
    })),
    cachedAt,
  }

  await redis.set(cacheKey, JSON.stringify(output), { px: CACHE_TTL_MS })
  return output
}
