import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { AirwallexError } from '@/server/airwallex/errors'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findCardById } from '@/server/repositories/cards'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import type { PanTokenOutput } from '@/shared/types/card'

export type PanTokenDeps = {
  airwallex?: AirwallexClient
}

export async function createPanTokenForCard(
  ctx: OrgContext,
  cardId: string,
  deps: PanTokenDeps = {},
): Promise<PanTokenOutput> {
  await connectDb()
  const card = await findCardById(ctx, cardId)
  if (!card) {
    throw AppError.notFound()
  }

  const client = deps.airwallex ?? getAirwallexClient()
  let aw
  try {
    aw = await client.panTokens.create({ card_id: card.airwallexCardId })
  } catch (error) {
    if (error instanceof AirwallexError) {
      throw AppError.upstreamError(error.message, {
        retryable: error.retryable,
        status: error.status,
        code: error.code,
      })
    }
    throw error
  }

  const output: PanTokenOutput = {
    token: aw.token,
    expiresAt: new Date(aw.expires_at).toISOString(),
  }

  await audit(ctx, {
    action: 'card.pan_token_created',
    subjectType: 'card',
    subjectId: card.id,
    projectId: card.projectId ?? undefined,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    metadata: { cardId: card.id },
  })

  return output
}
