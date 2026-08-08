import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findRoleById } from '@/server/repositories/roles'
import { computeEffectivePermissions } from '@/server/services/access/computeEffectivePermissions'
import { assertProjectInOrg } from '@/server/services/projectMembers/list'
import { OrgRole } from '@/shared/enums/orgRole'
import type {
  PreviewProjectMemberInput,
  PreviewProjectMemberOutput,
} from '@/shared/types/projectMember'

/**
 * Hypothetical effective permissions for a role+scope — no save.
 * Uses the same `computeEffectivePermissions` as enforcement.
 *
 * Preview assumes org `MEMBER` (the typical assignee). OWNER/ADMIN widening
 * is not applied here — that would describe the caller's power, not the role.
 */
export async function previewProjectMemberPermissions(
  ctx: OrgContext,
  projectId: string,
  input: PreviewProjectMemberInput,
  now: Date = new Date(),
): Promise<PreviewProjectMemberOutput> {
  await connectDb()
  await assertProjectInOrg(ctx, projectId)

  const role = await findRoleById(ctx, input.roleId)
  if (!role) {
    throw AppError.notFound()
  }

  const result = computeEffectivePermissions({
    orgRole: OrgRole.MEMBER,
    role,
    scope: input.scope,
    now,
  })

  return {
    permissions: result.permissions,
    scope: result.scope,
    reasons: result.reasons,
  }
}
