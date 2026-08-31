import { cardContracts } from '@/shared/contracts/card'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { getCardForOrg } from '@/server/services/cards/list'
import { updateCardForOrg } from '@/server/services/cards/update'
import { findCardById } from '@/server/repositories/cards'
import { permissionSubjectForCard } from '@/server/services/cards/subject'
import { Permission } from '@/shared/enums/permissions'

function requireCardId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

async function subjectForCard(ctx: Parameters<typeof findCardById>[0], cardId: string) {
  const card = await findCardById(ctx, cardId)
  if (!card) {
    throw AppError.notFound()
  }
  return {
    card,
    subject: permissionSubjectForCard(ctx, card),
  }
}

/** GET /api/cards/:id — `card.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const cardId = requireCardId(req)
    const { subject } = await subjectForCard(ctx, cardId)
    await requirePermission(ctx, Permission.CARD_VIEW, subject)
    return ok(await getCardForOrg(ctx, cardId))
  }),
)

/** PATCH /api/cards/:id — `card.manage`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(cardContracts.update.input, async (ctx, input, req) => {
      const cardId = requireCardId(req)
      const { subject } = await subjectForCard(ctx, cardId)
      await requirePermission(ctx, Permission.CARD_MANAGE, subject)
      return ok(await updateCardForOrg(ctx, cardId, input))
    }),
  ),
)
