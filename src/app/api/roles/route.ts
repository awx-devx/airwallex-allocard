import { roleContracts } from '@/shared/contracts/role'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { listRolesForOrg } from '@/server/services/roles/list'
import { createRoleForOrg } from '@/server/services/roles/mutate'
import { Permission } from '@/shared/enums/permissions'

/** List templates + custom roles — `member.view` (OWNER/ADMIN via short-circuit). */
export const GET = withAuth(async (ctx) => {
  await requirePermission(ctx, Permission.MEMBER_VIEW)
  return ok(await listRolesForOrg(ctx))
})

/** Create custom role — `role.assign`. */
export const POST = withAuth(
  withValidation(roleContracts.create.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.ROLE_ASSIGN)
    return created(await createRoleForOrg(ctx, input))
  }),
)
