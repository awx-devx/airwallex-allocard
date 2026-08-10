import { cardContracts } from '@/shared/contracts/card'
import { AppError } from '@/server/http/errors'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createCardForProject } from '@/server/services/cards/create'
import { listCardsForProject } from '@/server/services/cards/list'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/cards — `card.view`. */
export const GET = withRouteParams(
  withAuth(
    withValidation(cardContracts.listForProject.input, async (ctx, query, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.CARD_VIEW, { projectId })
      return ok(await listCardsForProject(ctx, projectId, query))
    }),
  ),
)

/** POST /api/projects/:id/cards — `card.create`. */
export const POST = withRouteParams(
  withAuth(
    withValidation(cardContracts.create.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.CARD_CREATE, { projectId })
      return created(await createCardForProject(ctx, projectId, input))
    }),
  ),
)
