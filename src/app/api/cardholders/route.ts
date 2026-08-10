import { cardholderContracts } from '@/shared/contracts/cardholder'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { listCardholdersForOrg } from '@/server/services/cardholders/list'
import { Permission } from '@/shared/enums/permissions'

/** GET /api/cardholders — `card.view`. */
export const GET = withAuth(
  withValidation(cardholderContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.CARD_VIEW)
    return ok(await listCardholdersForOrg(ctx, query))
  }),
)

/** POST /api/cardholders — `member.manage`. */
export const POST = withAuth(
  withValidation(cardholderContracts.create.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.MEMBER_MANAGE)
    return created(await createCardholderForOrg(ctx, input))
  }),
)
