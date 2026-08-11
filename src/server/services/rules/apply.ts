/**
 * Pipeline step 7 — apply desired state (RULES-ENGINE §4/§5).
 *
 * Order matters here. The Redis policy snapshot is written **before** the
 * Airwallex patch is confirmed, because remote authorization reads the snapshot,
 * not Airwallex. Writing it synchronously during evaluation is what closes the
 * window in which a card is over-provisioned relative to policy while the patch
 * is still in flight.
 *
 * On an Airwallex 5xx the desired state stays persisted and the card is left for
 * the reconciler's next pass — nothing is lost, and one failing card never stops
 * the others.
 */
import { AirwallexError } from '@/server/airwallex/errors'
import type { AirwallexClient } from '@/server/airwallex/client'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys } from '@/server/redis'
import { findCardById, updateDesiredControls } from '@/server/repositories/cards'
import { closeCard, freezeCard, unfreezeCard } from '@/server/services/cards/lifecycle'
import { reconcileCard } from '@/server/services/cards/reconciler'
import { ErrorCode } from '@/shared/enums/errors'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { CardStatus } from '@/shared/enums/cardStatus'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { CardControls } from '@/shared/types/cardControls'
import type { DesiredCardState } from '@/shared/types/ruleRun'

export type ApplyDeps = {
  airwallex?: AirwallexClient
}

export type ApplyCardOutcome = {
  cardId: string
  status: ActionResultStatus
  message: string | null
  /** True when the Airwallex push should be retried on a later pass. */
  retryable: boolean
  snapshotWritten: boolean
}

/**
 * Flattened per-card policy for the remote-auth hot path (RULES-ENGINE §5).
 * Amounts are integer minor units, like everywhere else in the system.
 */
export type CardPolicySnapshot = {
  cardId: string
  projectId: string | null
  orgId: string
  version: number
  hardStops: {
    projectRemaining: number | null
    memberMtdCap: number | null
    memberMtdSpent: number | null
    allowedMcc: string[] | null
    allowedCountries: string[] | null
    requireApprovalAbove: number | null
    approvedRequestIds: string[]
  }
  refreshedAt: string
}

function numberOrNull(value: AttributeLiteral | undefined): number | null {
  return typeof value === 'number' ? value : null
}

/**
 * Rules state the fields they care about; everything else keeps its current
 * value. Desired state is recomputed wholesale, but silence is not a request to
 * clear a field.
 */
export function mergeIntoControls(
  applied: CardControls,
  desired: DesiredCardState['controls'],
): CardControls {
  if (!desired) {
    return applied
  }
  return {
    ...applied,
    ...desired,
    transactionLimits: desired.transactionLimits ?? applied.transactionLimits,
  }
}

export async function writePolicySnapshot(
  ctx: OrgContext,
  input: {
    cardId: string
    projectId: string | null
    controls: CardControls
    attributeValues: Map<string, AttributeLiteral>
    now: Date
  },
): Promise<CardPolicySnapshot> {
  const redis = getRedis()
  const key = redisKeys.policyCard(input.cardId)

  let version = 1
  const existing = await redis.get(key)
  if (existing) {
    try {
      version = (JSON.parse(existing) as CardPolicySnapshot).version + 1
    } catch {
      // A corrupt snapshot is replaced, not trusted.
    }
  }

  const snapshot: CardPolicySnapshot = {
    cardId: input.cardId,
    projectId: input.projectId,
    orgId: ctx.orgId,
    version,
    hardStops: {
      projectRemaining: numberOrNull(input.attributeValues.get('project.budget.remaining')),
      // TODO(B8): member caps and month-to-date spend need cleared transactions.
      memberMtdCap: null,
      memberMtdSpent: numberOrNull(input.attributeValues.get('member.spend.mtd')),
      allowedMcc: input.controls.allowedMerchantCategories,
      allowedCountries: input.controls.allowedMerchantCountries,
      // TODO(B7): approval policy defines the threshold and approved requests.
      requireApprovalAbove: null,
      approvedRequestIds: [],
    },
    refreshedAt: input.now.toISOString(),
  }

  const ok = await redis.set(key, JSON.stringify(snapshot))
  if (!ok) {
    throw new Error(`Failed to write Redis policy snapshot at ${key}`)
  }
  return snapshot
}

async function applyStatus(
  ctx: OrgContext,
  cardId: string,
  desired: DesiredCardStatus,
  current: CardStatus,
  deps: ApplyDeps,
  options: { allowDestructiveClose?: boolean } = {},
): Promise<void> {
  if (desired === DesiredCardStatus.CLOSED) {
    if (current === CardStatus.CLOSED) {
      return
    }
    // Belt-and-suspenders: never push CLOSED from rules without the flag.
    if (options.allowDestructiveClose !== true) {
      throw AppError.conflict(
        'card.close requires allowDestructive: true (refusing to close from rules)',
      )
    }
    await closeCard(ctx, cardId, { confirm: true }, deps)
    return
  }
  if (desired === DesiredCardStatus.INACTIVE) {
    if (current !== CardStatus.INACTIVE) {
      await freezeCard(ctx, cardId, deps)
    }
    return
  }
  if (current === CardStatus.INACTIVE) {
    await unfreezeCard(ctx, cardId, deps)
  }
}

function isRetryable(error: unknown): boolean {
  if (error instanceof AirwallexError) {
    return error.retryable
  }
  if (error instanceof AppError && error.code === ErrorCode.UPSTREAM_ERROR) {
    return Boolean((error.details as { retryable?: boolean } | undefined)?.retryable)
  }
  return false
}

/**
 * Persist and push one card's desired state. Never throws for a single card —
 * the outcome carries the failure so sibling cards still get applied.
 */
export async function applyCard(
  ctx: OrgContext,
  desired: DesiredCardState,
  input: {
    attributeValues: Map<string, AttributeLiteral>
    now: Date
  },
  deps: ApplyDeps = {},
): Promise<ApplyCardOutcome> {
  const base = { cardId: desired.cardId, retryable: false, snapshotWritten: false }

  const card = await findCardById(ctx, desired.cardId)
  if (!card) {
    return {
      ...base,
      status: ActionResultStatus.FAILED,
      message: 'Card not found in this organisation',
    }
  }
  if (card.status === CardStatus.CLOSED) {
    return {
      ...base,
      status: ActionResultStatus.SKIPPED,
      message: 'Card is CLOSED',
    }
  }

  const controls = mergeIntoControls(card.appliedControls, desired.controls)

  if (desired.controls) {
    await updateDesiredControls(ctx, desired.cardId, controls)
  }

  // Written before the Airwallex round-trip: the remote-auth path reads this,
  // and it must be current even while the patch is still in flight.
  await writePolicySnapshot(ctx, {
    cardId: desired.cardId,
    projectId: card.projectId,
    controls,
    attributeValues: input.attributeValues,
    now: input.now,
  })

  try {
    if (desired.cardStatus) {
      await applyStatus(ctx, desired.cardId, desired.cardStatus, card.status, deps, {
        allowDestructiveClose: desired.allowDestructiveClose === true,
      })
    }
    if (desired.controls) {
      await reconcileCard(ctx, desired.cardId, deps)
    }
  } catch (error) {
    const retryable = isRetryable(error)
    return {
      ...base,
      snapshotWritten: true,
      retryable,
      status: ActionResultStatus.FAILED,
      message: retryable
        ? 'Airwallex unavailable; desired state kept for the next reconciler pass'
        : error instanceof Error
          ? error.message
          : 'Apply failed',
    }
  }

  return {
    ...base,
    snapshotWritten: true,
    status: ActionResultStatus.APPLIED,
    message: null,
  }
}
