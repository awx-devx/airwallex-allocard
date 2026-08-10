import { cardContracts } from '@/shared/contracts/card'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { findCardById } from '@/server/repositories/cards'
import { closeCard } from '@/server/services/cards/lifecycle'
import { Permission } from '@/shared/enums/permissions'

function requireCardId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) throw AppError.notFound()
  return id
}

export const POST = withRouteParams(
  withAuth(
    withValidation(cardContracts.close.input, async (ctx, input, req) => {
      const cardId = requireCardId(req)
      const card = await findCardById(ctx, cardId)
      if (!card) throw AppError.notFound()
      await requirePermission(ctx, Permission.CARD_MANAGE, {
        projectId: card.projectId ?? undefined,
        cardId: card.id,
      })
      return ok(await closeCard(ctx, cardId, input))
    }),
  ),
)
