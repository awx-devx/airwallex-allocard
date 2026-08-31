/**
 * Issue a card: persist a local PENDING stub, then attach an existing Airwallex
 * card (by metadata.cardDocId) or create one with a stable request_id.
 */
import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import {
  cardRequestId,
  isIssuableCardholderId,
  type AirwallexCard,
  type CreateCardBody,
} from '@/server/airwallex/types'
import { loadServerEnv } from '@/server/env'
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
  updateCardCardholderId,
} from '@/server/repositories/cards'
import { findProjectById } from '@/server/repositories/projects'
import { findUserById } from '@/server/repositories/users'
import { audit } from '@/server/services/audit/log'
import { purposeToTransactionCount, toAirwallexControls } from '@/server/services/cards/controls'
import { ensureOrgDelegateCardholder } from '@/server/services/cardholders/ensure'
import { ActorType } from '@/shared/enums/audit'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import type { Card, CreateCardInput } from '@/shared/types/card'
import type { CardControls } from '@/shared/types/cardControls'

export type CreateCardDeps = {
  airwallex?: AirwallexClient
  useFixtures?: boolean
}

function resolveUseFixtures(deps: CreateCardDeps): boolean {
  return deps.useFixtures ?? loadServerEnv().AIRWALLEX_USE_FIXTURES
}

/** Airwallex `created_by` must be a legal name, never a user id. */
export const AIRWALLEX_CREATED_BY_FALLBACK = 'Allocard Operator'

export function isProvisionalAirwallexId(id: string): boolean {
  return id.startsWith('pending:')
}

function warnCard(action: string, error: unknown, extra: Record<string, string>): void {
  const message = error instanceof Error ? error.message : 'unknown error'
  console.warn('[cards]', action, { ...extra, message })
}

function mapAwCardStatus(status: string | undefined): CardStatus {
  switch (status) {
    case CardStatus.PENDING:
    case CardStatus.ACTIVE:
    case CardStatus.INACTIVE:
    case CardStatus.CLOSED:
    case CardStatus.BLOCKED:
    case CardStatus.LOST:
    case CardStatus.STOLEN:
    case CardStatus.FAILED:
      return status
    default:
      return CardStatus.ACTIVE
  }
}

async function resolveCreatedByName(userId: string): Promise<string> {
  const user = await findUserById(userId)
  const name = user?.name.trim()
  if (name !== undefined && name.length > 0) {
    return name
  }
  return AIRWALLEX_CREATED_BY_FALLBACK
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

/**
 * Pinned API `2024-02-22` create body.
 * Always `issue_to: ORGANISATION` + `purpose: TEAM_EXPENSES` so Reveal can
 * use GET .../details (PCI denies pantokens on personalized / INDIVIDUAL
 * cards). Do not send `program`, `is_personalized`, or `cardholder_id` —
 * organisation cards are issued to the account (`400 cardholder_id must be
 * null when issue_to is set to ORGANISATION`).
 */
export function buildCreateCardBody(input: {
  localCardId: string
  createdBy: string
  purpose: CardPurpose
  nickName: string
  orgId: string
  projectId: string | null
  controls: CardControls
}): CreateCardBody {
  return {
    request_id: cardRequestId(input.localCardId),
    created_by: input.createdBy,
    form_factor: 'VIRTUAL',
    issue_to: 'ORGANISATION',
    purpose: 'TEAM_EXPENSES',
    nick_name: input.nickName.replace(/[—–]/g, '-').slice(0, 100),
    metadata: {
      orgId: input.orgId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      cardDocId: input.localCardId,
    },
    authorization_controls: toAirwallexControls(input.controls),
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

async function findAirwallexCardByDocId(
  ctx: OrgContext,
  card: Card,
  client: AirwallexClient,
): Promise<AirwallexCard | null> {
  let pageNum = 1
  for (;;) {
    const page = await client.cards.list(ctx, {
      pageNum,
      pageSize: 100,
      ...(card.projectId ? { projectId: card.projectId } : {}),
    })
    const items = page?.items ?? []
    const hit = items.find((item) => item.metadata?.cardDocId === card.id)
    if (hit) {
      return hit
    }
    if (!page?.has_more) {
      return null
    }
    pageNum += 1
  }
}

async function applyAirwallexCard(ctx: OrgContext, card: Card, aw: AirwallexCard): Promise<Card> {
  let awCardId = aw.card_id
  const clash = await findCardByAirwallexId(ctx, awCardId)
  if (clash && clash.id !== card.id) {
    awCardId = `${aw.card_id}:${card.id}`
  }

  const updated = await updateCardAirwallexFields(ctx, card.id, {
    airwallexCardId: awCardId,
    maskedNumber: aw.card_number ?? '************0000',
    status: mapAwCardStatus(aw.card_status),
  })
  let next = updated ?? card
  const applied = await updateAppliedControls(ctx, card.id, card.desiredControls)
  if (applied) {
    next = applied
  }
  return next
}

async function recordIssued(ctx: OrgContext, card: Card): Promise<void> {
  const actorType = ctx.userId === 'system' ? ActorType.SYSTEM : ActorType.USER
  await audit(ctx, {
    action: 'card.created',
    subjectType: 'card',
    subjectId: card.id,
    projectId: card.projectId ?? undefined,
    actorType,
    actorId: ctx.userId,
    after: card,
    metadata: { purpose: card.purpose, cardholderId: card.cardholderId },
  })

  await publishEvent({
    type: DomainEventType.CARD_CREATED,
    orgId: ctx.orgId,
    projectId: card.projectId ?? undefined,
    subjectType: 'card',
    subjectId: card.id,
    payload: {
      cardId: card.id,
      projectId: card.projectId,
      purpose: card.purpose,
      cardholderId: card.cardholderId,
    },
  })
}

/**
 * Finish a local PENDING stub: attach by metadata.cardDocId, else create with
 * the same request_id. Never throws on Airwallex failure — leaves PENDING.
 */
export async function completePendingCard(
  ctx: OrgContext,
  card: Card,
  deps: CreateCardDeps = {},
): Promise<Card> {
  await connectDb()

  if (!isProvisionalAirwallexId(card.airwallexCardId)) {
    return card
  }

  const cardholder = await ensureOrgDelegateCardholder(ctx, deps)
  if (card.cardholderId !== cardholder.id) {
    const patched = await updateCardCardholderId(ctx, card.id, cardholder.id)
    if (patched) {
      card = patched
    }
  }
  if (cardholder.status !== CardholderStatus.READY) {
    warnCard('create', new Error(`cardholder is ${cardholder.status}; wait until READY`), {
      cardId: card.id,
      airwallexCardholderId: cardholder.airwallexCardholderId,
      status: cardholder.status,
    })
    return card
  }

  const useFixtures = resolveUseFixtures(deps)
  if (!isIssuableCardholderId(cardholder.airwallexCardholderId, useFixtures)) {
    warnCard('create', new Error('cardholder still has a non-UUID Airwallex id; not creating'), {
      cardId: card.id,
      airwallexCardholderId: cardholder.airwallexCardholderId,
    })
    return card
  }

  const client = deps.airwallex ?? getAirwallexClient()

  try {
    const existing = await findAirwallexCardByDocId(ctx, card, client)
    if (existing) {
      const hooked = await applyAirwallexCard(ctx, card, existing)
      await recordIssued(ctx, hooked)
      return hooked
    }
  } catch (error) {
    warnCard('list', error, { cardId: card.id })
  }

  try {
    const body = buildCreateCardBody({
      localCardId: card.id,
      createdBy: await resolveCreatedByName(ctx.userId),
      purpose: card.purpose,
      nickName: card.nickName,
      orgId: ctx.orgId,
      projectId: card.projectId,
      controls: card.desiredControls,
    })
    const aw = await client.cards.create(body)
    const hooked = await applyAirwallexCard(ctx, card, aw)
    await recordIssued(ctx, hooked)
    return hooked
  } catch (error) {
    warnCard('create', error, { cardId: card.id })
    return (await findCardById(ctx, card.id)) ?? card
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

  const requested = await findCardholderById(ctx, input.cardholderId)
  if (!requested) {
    throw AppError.notFound()
  }

  const cardholder = await ensureOrgDelegateCardholder(ctx, deps)
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
  const card = await createCard(ctx, {
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

  const completed = await completePendingCard(ctx, card, deps)
  if (isProvisionalAirwallexId(completed.airwallexCardId)) {
    throw AppError.upstreamError('Airwallex card create failed', {
      retryable: true,
      cardId: card.id,
    })
  }

  return (await findCardById(ctx, completed.id)) ?? completed
}
