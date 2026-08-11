/**
 * Approver queue across projects — shell badge + list.
 * OWNER/ADMIN see the org; MEMBER is filtered to projects granting `request.approve`.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { projectIdsGrantingPermission } from '@/server/http/requirePermission'
import type { OrgContext } from '@/server/http/types'
import { listPendingForApprover } from '@/server/repositories/purchaseRequests'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type {
  ApprovalsCount,
  ListApprovalsQuery,
  PurchaseRequestList,
} from '@/shared/types/purchaseRequest'

function isElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

/**
 * Resolve project scope for the queue.
 * Elevated → undefined (whole org). MEMBER → ids granting REQUEST_APPROVE, or deny.
 */
async function resolveApproverProjectIds(ctx: OrgContext): Promise<string[] | undefined> {
  if (isElevated(ctx.orgRole)) {
    return undefined
  }
  const projectIds = await projectIdsGrantingPermission(ctx, Permission.REQUEST_APPROVE)
  if (projectIds.length === 0) {
    throw AppError.permissionDenied(Permission.REQUEST_APPROVE)
  }
  return projectIds
}

/** GET /api/approvals — PENDING queue, oldest first; excludes the caller's own requests. */
export async function listApprovalsQueue(
  ctx: OrgContext,
  query: ListApprovalsQuery,
): Promise<PurchaseRequestList> {
  await connectDb()
  const projectIds = await resolveApproverProjectIds(ctx)
  return listPendingForApprover(ctx, {
    page: query.page,
    pageSize: query.pageSize,
    excludeRequesterId: ctx.userId,
    projectIds,
  })
}

/** GET /api/approvals/count — badge count (same filter as the queue). */
export async function countApprovalsQueue(ctx: OrgContext): Promise<ApprovalsCount> {
  await connectDb()
  const projectIds = await resolveApproverProjectIds(ctx)
  const list = await listPendingForApprover(ctx, {
    page: 1,
    pageSize: 1,
    excludeRequesterId: ctx.userId,
    projectIds,
  })
  return { count: list.total }
}
