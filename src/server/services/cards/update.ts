import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findCardById,
  updateCardAccessList,
  updateCardNickname,
  updateDesiredControls,
} from '@/server/repositories/cards'
import { audit } from '@/server/services/audit/log'
import {
  assertTransactionCountImmutable,
  toAirwallexControls,
} from '@/server/services/cards/controls'
import { reconcileCard, type ReconcileCardDeps } from '@/server/services/cards/reconciler'
import { ActorType } from '@/shared/enums/audit'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { Card, UpdateCardInput } from '@/shared/types/card'
import type { CardControls } from '@/shared/types/cardControls'

export type UpdateCardDeps = ReconcileCardDeps

function mergeControls(
  existing: CardControls,
  patch: NonNullable<UpdateCardInput['desiredControls']>,
): CardControls {
  return {
    allowedTransactionCount: existing.allowedTransactionCount,
    transactionLimits: patch.transactionLimits ?? existing.transactionLimits,
    activeFrom: patch.activeFrom !== undefined ? patch.activeFrom : existing.activeFrom,
    activeTo: patch.activeTo !== undefined ? patch.activeTo : existing.activeTo,
    allowedCurrencies:
      patch.allowedCurrencies !== undefined ? patch.allowedCurrencies : existing.allowedCurrencies,
    allowedMerchantCategories:
      patch.allowedMerchantCategories !== undefined
        ? patch.allowedMerchantCategories
        : existing.allowedMerchantCategories,
    allowedMerchantCountries:
      patch.allowedMerchantCountries !== undefined
        ? patch.allowedMerchantCountries
        : existing.allowedMerchantCountries,
    allowedMerchantBrands:
      patch.allowedMerchantBrands !== undefined
        ? patch.allowedMerchantBrands
        : existing.allowedMerchantBrands,
    blockedTransactionUsages:
      patch.blockedTransactionUsages !== undefined
        ? patch.blockedTransactionUsages
        : existing.blockedTransactionUsages,
  }
}

export async function updateCardForOrg(
  ctx: OrgContext,
  cardId: string,
  input: UpdateCardInput,
  deps: UpdateCardDeps = {},
): Promise<Card> {
  await connectDb()

  const before = await findCardById(ctx, cardId)
  if (!before) {
    throw AppError.notFound()
  }
  if (before.status === CardStatus.CLOSED) {
    throw AppError.conflict('Card is CLOSED')
  }

  let card = before

  if (input.nickName !== undefined) {
    const updated = await updateCardNickname(ctx, cardId, input.nickName)
    if (updated) card = updated
  }

  if (input.accessList !== undefined) {
    const updated = await updateCardAccessList(ctx, cardId, input.accessList)
    if (updated) card = updated
  }

  if (input.desiredControls !== undefined) {
    // Schema omits allowedTransactionCount; defend anyway.
    assertTransactionCountImmutable(
      before.desiredControls.allowedTransactionCount,
      (
        input.desiredControls as {
          allowedTransactionCount?: CardControls['allowedTransactionCount']
        }
      ).allowedTransactionCount,
    )

    const next = mergeControls(before.desiredControls, input.desiredControls)
    // Empty allowlist trap before Airwallex.
    toAirwallexControls(next)

    const updated = await updateDesiredControls(ctx, cardId, next)
    if (updated) card = updated

    card = await reconcileCard(ctx, cardId, deps)
  }

  await audit(ctx, {
    action: 'card.updated',
    subjectType: 'card',
    subjectId: card.id,
    projectId: card.projectId ?? undefined,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after: card,
  })

  return card
}
