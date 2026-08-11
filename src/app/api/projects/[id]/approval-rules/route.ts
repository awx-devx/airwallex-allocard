import { approvalRuleContracts } from '@/shared/contracts/approvalRule'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  listProjectApprovalRules,
  putProjectApprovalRules,
} from '@/server/services/approvals/rules'
import { Permission } from '@/shared/enums/permissions'

function requireProjectId(req: Request): string {
  const { id } = getRouteParams(req)
  if (!id) {
    throw AppError.notFound()
  }
  return id
}

/** GET /api/projects/:id/approval-rules — `control.edit` with projectId. */
export const GET = withRouteParams(
  withAuth(async (ctx, req) => {
    const projectId = requireProjectId(req)
    await requirePermission(ctx, Permission.CONTROL_EDIT, { projectId })
    return ok(await listProjectApprovalRules(ctx, projectId))
  }),
)

/** PUT /api/projects/:id/approval-rules — replace-all; one audit entry. */
export const PUT = withRouteParams(
  withAuth(
    withValidation(approvalRuleContracts.put.input, async (ctx, input, req) => {
      const projectId = requireProjectId(req)
      await requirePermission(ctx, Permission.CONTROL_EDIT, { projectId })
      return ok(await putProjectApprovalRules(ctx, projectId, input))
    }),
  ),
)
