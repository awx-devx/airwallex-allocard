import { accessReviewContracts } from '@/shared/contracts/accessReview'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listAccessReviewsForOrg } from '@/server/services/accessReviews/list'
import { Permission } from '@/shared/enums/permissions'

/**
 * List access reviews — `member.manage`.
 * Org-wide; OWNER/ADMIN short-circuit until B3.11 grants via project membership.
 */
export const GET = withAuth(
  withValidation(accessReviewContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.MEMBER_MANAGE)
    return ok(await listAccessReviewsForOrg(ctx, query))
  }),
)
