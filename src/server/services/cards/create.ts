import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { cardRequestId } from '@/server/airwallex/types'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import { ErrorCode } from '@/shared/enums/errors'
import type { OrgContext } from '@/server/http/types'
import { findCardholderById } from '@/server/repositories/cardholders'
import {
  createCard,
  findCardByAirwallexId,
  findCardById,
  updateAppliedControls,
  updateCardAirwallexFields,
} from '@/server/repositories/cards'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { purposeToTransactionCount, toAirwallexControls } from '@/server/services/cards/controls'
import { ActorType } from '@/shared/enums/audit'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import type { Card, CreateCardInput } from '@/shared/types/card'
import type { CardControls } from '@/shared/types/cardControls'

export type CreateCardDeps = {
  airwallex?: AirwallexClient
}

function assertNoEmptyAllowlists(controls: CardControls): void {
  for (const [field, value] of [
    ['allowedCurrencies', controls.allowedCurrencies],
    ['allowedMerchantCategories', controls.allowedMerchantCategories],
    ['allowedMerchantCountries', controls.allowedMerchantCountries],
    ['allowedMerchantBrands', controls.allowedMerchantBrands],
  ] as const) {
    if (value !== null && value.length === 0) {
      throw AppError.validationFailed({ [field]: ['Empty allowlist is not allowed'] })
    }
  }
}

function resolveControls(input: CreateCardInput): CardControls {
  const allowedTransactionCount =
    input.desiredControls.allowedTransactionCount ?? purposeToTransactionCount(input.purpose)

  return {
    allowedTransactionCount,
    transactionLimits: input.desiredControls.transactionLimits,
    activeFrom: input.desiredControls.activeFrom,
    activeTo: input.desiredControls.activeTo,
    allowedCurrencies: input.desiredControls.allowedCurrencies,
    allowedMerchantCategories: input.desiredControls.allowedMerchantCategories,
    allowedMerchantCountries: input.desiredControls.allowedMerchantCountries,
    allowedMerchantBrands: input.desiredControls.allowedMerchantBrands,
    blockedTransactionUsages: input.desiredControls.blockedTransactionUsages,
  }
}

export async function createCardForProject(
  ctx: OrgContext,
  projectId: string,
  input: CreateCardInput,
  deps: CreateCardDeps = {},
): Promise<Card> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const cardholder = await findCardholderById(ctx, input.cardholderId)
  if (!cardholder) {
    throw AppError.notFound()
  }

  if (cardholder.status !== CardholderStatus.READY) {
    throw new AppError(
      ErrorCode.CONFLICT,
      `Cardholder is ${cardholder.status}; wait until READY before issuing a card`,
      { retryable: true, cardholderStatus: cardholder.status },
    )
  }

  const desiredControls = resolveControls(input)
  assertNoEmptyAllowlists(desiredControls)

  // Reject empty allowlists before any Airwallex call (also caught by schema).
  toAirwallexControls(desiredControls)

  const nickName =
    input.nickName ??
    `${project.code} — ${input.purpose === CardPurpose.MEMBER ? 'member' : input.purpose.toLowerCase()}`

  const provisionalAwId = `pending:${randomUUID()}`
  let card = await createCard(ctx, {
    projectId,
    categoryId: input.categoryId ?? null,
    cardholderId: cardholder.id,
    airwallexCardId: provisionalAwId,
    maskedNumber: '************0000',
    nickName: nickName.slice(0, 100),
    purpose: input.purpose,
    status: CardStatus.PENDING,
    desiredControls,
    appliedControls: desiredControls,
    accessList: input.accessList ?? [ctx.userId],
  })

  const client = deps.airwallex ?? getAirwallexClient()
  const isPersonalized = input.purpose === CardPurpose.MEMBER

  try {
    const aw = await client.cards.create({
      request_id: cardRequestId(card.id),
      cardholder_id: cardholder.airwallexCardholderId,
      created_by: ctx.userId,
      form_factor: 'VIRTUAL',
      is_personalized: isPersonalized,
      ...(isPersonalized ? {} : { additional_cardholder_ids: [] }),
      program: { purpose: 'COMMERCIAL', type: 'PREPAID' },
      purpose: 'TEAM_EXPENSES',
      nick_name: card.nickName,
      metadata: {
        orgId: ctx.orgId,
        projectId,
        cardDocId: card.id,
      },
      authorization_controls: toAirwallexControls(desiredControls),
    })

    // Fixture mode returns a static card_id; uniquify on collision within the org.
    let awCardId = aw.card_id
    const clash = await findCardByAirwallexId(ctx, awCardId)
    if (clash && clash.id !== card.id) {
      awCardId = `${aw.card_id}:${card.id}`
    }

    const updated = await updateCardAirwallexFields(ctx, card.id, {
      airwallexCardId: awCardId,
      maskedNumber: aw.card_number ?? '************0000',
      status: (aw.card_status as CardStatus) ?? CardStatus.ACTIVE,
    })
    if (updated) {
      card = updated
    }
    const applied = await updateAppliedControls(ctx, card.id, desiredControls)
    if (applied) {
      card = applied
    }
  } catch (error) {
    // Leave local PENDING for idempotent retry with same request_id.
    if (error instanceof AppError) {
      throw error
    }
    const message = error instanceof Error ? error.message : 'Airwallex card create failed'
    throw AppError.upstreamError(message, {
      retryable: true,
      cardId: card.id,
    })
  }

  await audit(ctx, {
    action: 'card.created',
    subjectType: 'card',
    subjectId: card.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: card,
    metadata: { purpose: card.purpose, cardholderId: card.cardholderId },
  })

  await publishEvent({
    type: DomainEventType.CARD_CREATED,
    orgId: ctx.orgId,
    projectId,
    subjectType: 'card',
    subjectId: card.id,
    payload: {
      cardId: card.id,
      projectId,
      purpose: card.purpose,
      cardholderId: card.cardholderId,
    },
  })

  return (await findCardById(ctx, card.id)) ?? card
}
