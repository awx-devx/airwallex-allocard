import { inviteContracts } from '@/shared/contracts/invite'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createOrgInvite, listOrgInvites } from '@/server/services/invites/create'

/** Create invite — `org.manage`. Raw token returned once. */
export const POST = withAuth(
  withValidation(inviteContracts.create.input, async (ctx, input) => {
    await requirePermission(ctx, 'org.manage')
    return created(await createOrgInvite(ctx, input))
  }),
)

/** List pending invites — `org.manage`. */
export const GET = withAuth(async (ctx) => {
  await requirePermission(ctx, 'org.manage')
  return ok(await listOrgInvites(ctx))
})
