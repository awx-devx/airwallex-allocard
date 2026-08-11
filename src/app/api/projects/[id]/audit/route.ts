import { auditContracts } from '@/shared/contracts/audit'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { connectDb } from '@/server/db/connect'
import { findProjectById } from '@/server/repositories/projects'
import { listAudit } from '@/server/services/audit/query'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/audit — project-scoped audit list (`member.manage`). */
export const GET = withRouteParams(
  withAuth(
    withValidation(auditContracts.listForProject.input, async (ctx, query, req) => {
      const projectId = requireProjectId(req)
      await connectDb()
      const project = await findProjectById(ctx, projectId)
      if (!project) {
        throw AppError.notFound()
      }
      await requirePermission(ctx, Permission.MEMBER_MANAGE, { projectId })
      return ok(
        await listAudit(ctx, {
          ...query,
          projectId,
        }),
      )
    }),
  ),
)
