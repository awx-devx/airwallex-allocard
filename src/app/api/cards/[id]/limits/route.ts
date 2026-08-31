import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { findCardById } from '@/server/repositories/cards'
import { getCardLimits } from '@/server/services/cards/limits'
import { permissionSubjectForCard } from '@/server/services/cards/subject'
import { Permission } from '@/shared/enums/permissions'

function requireCardId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) throw AppError.notFound()
  return id
}

export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const cardId = requireCardId(req)
    const card = await findCardById(ctx, cardId)
    if (!card) throw AppError.notFound()
    await requirePermission(ctx, Permission.CARD_VIEW, permissionSubjectForCard(ctx, card))
    return ok(await getCardLimits(ctx, cardId))
  }),
)
