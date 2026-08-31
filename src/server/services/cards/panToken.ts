import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { AirwallexError } from '@/server/airwallex/errors'
import type { AirwallexCard, AirwallexCardDetails } from '@/server/airwallex/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findCardById } from '@/server/repositories/cards'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import type { PanTokenOutput } from '@/shared/types/card'

export type PanTokenDeps = {
  airwallex?: AirwallexClient
}

function usesDirectReveal(awCard: AirwallexCard): boolean {
  if (awCard.issue_to === 'ORGANISATION') return true
  if (awCard.issue_to === 'INDIVIDUAL') return false
  return awCard.cardholder_id == null || awCard.cardholder_id === ''
}

function requiredDetail(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value === 'string' && value.trim().length >= 1) {
    return value.trim()
  }
  throw AppError.upstreamError('Card details were incomplete')
}

function mapDirectDetails(raw: AirwallexCardDetails): PanTokenOutput {
  return {
    kind: 'direct',
    number: requiredDetail(raw.card_number),
    cvv: requiredDetail(raw.cvv),
    expiryMonth: requiredDetail(raw.expiry_month),
    expiryYear: requiredDetail(raw.expiry_year),
  }
}

function mapUpstream(error: unknown): never {
  if (error instanceof AirwallexError) {
    throw AppError.upstreamError(error.message, {
      retryable: error.retryable,
      status: error.status,
      code: error.code,
    })
  }
  throw error
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
  let output: PanTokenOutput
  try {
    const awCard = await client.cards.get(card.airwallexCardId)
    if (usesDirectReveal(awCard)) {
      const details = await client.cards.details(card.airwallexCardId)
      output = mapDirectDetails(details)
    } else {
      const aw = await client.panTokens.create({ card_id: card.airwallexCardId })
      output = {
        kind: 'iframe',
        token: aw.token,
        expiresAt: new Date(aw.expires_at).toISOString(),
      }
    }
  } catch (error) {
    return mapUpstream(error)
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
