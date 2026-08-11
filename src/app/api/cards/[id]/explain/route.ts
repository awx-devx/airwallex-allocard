import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { findCardById } from '@/server/repositories/cards'
import { explainCard } from '@/server/services/rules/explain'
import { Permission } from '@/shared/enums/permissions'

function requireCardId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** Explain card limits — `card.view`. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const cardId = requireCardId(req)
    const card = await findCardById(ctx, cardId)
    if (!card) {
      throw AppError.notFound()
    }
    await requirePermission(ctx, Permission.CARD_VIEW, {
      projectId: card.projectId ?? undefined,
      cardId: card.id,
    })
    return ok(await explainCard(ctx, cardId))
  }),
)
