import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { findCardById } from '@/server/repositories/cards'
import { createPanTokenForCard } from '@/server/services/cards/panToken'
import { permissionSubjectForCard } from '@/server/services/cards/subject'
import { Permission } from '@/shared/enums/permissions'

function requireCardId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) throw AppError.notFound()
  return id
}

/** POST pan-token — requires `card.viewDetails` + scope. Audited in service. */
export const POST = withRouteParams(
  withAuth(async (ctx, req) => {
    const cardId = requireCardId(req)
    const card = await findCardById(ctx, cardId)
    if (!card) throw AppError.notFound()
    await requirePermission(ctx, Permission.CARD_VIEW_DETAILS, permissionSubjectForCard(ctx, card))
    return ok(await createPanTokenForCard(ctx, cardId))
  }),
)
