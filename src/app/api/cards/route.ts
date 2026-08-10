import { cardContracts } from '@/shared/contracts/card'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listCardsForOrg } from '@/server/services/cards/list'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'

/** GET /api/cards — org-wide, `card.view`, scope-filtered in service. */
export const GET = withAuth(
  withValidation(cardContracts.list.input, async (ctx, query) => {
    // OWNER/ADMIN short-circuit; MEMBER path enforced inside listCardsForOrg.
    if (ctx.orgRole === OrgRole.OWNER || ctx.orgRole === OrgRole.ADMIN) {
      await requirePermission(ctx, Permission.CARD_VIEW)
    }
    return ok(await listCardsForOrg(ctx, query))
  }),
)
