import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { countActiveProjectMembersByRole } from '@/server/repositories/projectMembers'
import { deleteRole, findRoleById } from '@/server/repositories/roles'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'

/** Delete a role. Rejected while assigned to any active project member. */
export async function deleteRoleForOrg(ctx: OrgContext, roleId: string): Promise<void> {
  await connectDb()

  const before = await findRoleById(ctx, roleId)
  if (!before) {
    throw AppError.notFound()
  }

  const assigned = await countActiveProjectMembersByRole(ctx, roleId)
  if (assigned > 0) {
    throw AppError.conflict('Role is assigned to project members and cannot be deleted')
  }

  const deleted = await deleteRole(ctx, roleId)
  if (!deleted) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'role.deleted',
    subjectType: 'role',
    subjectId: roleId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
  })
}
