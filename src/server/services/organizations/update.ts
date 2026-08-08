import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { audit } from '@/server/services/audit/log'
import {
  findOrganizationById,
  updateOrganization as updateOrganizationRecord,
} from '@/server/repositories/organizations'
import { ActorType } from '@/shared/enums/audit'
import type { Organization, UpdateOrganizationInput } from '@/shared/types/organization'

/**
 * Update organisation settings. Caller must already have passed `org.manage`.
 * Path id must match `ctx.orgId` — cross-org → 404.
 */
export async function updateOrganization(
  ctx: OrgContext,
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  await connectDb()

  if (ctx.orgId !== orgId) {
    throw AppError.notFound()
  }

  const before = await findOrganizationById(orgId)
  if (!before) {
    throw AppError.notFound()
  }

  const after = await updateOrganizationRecord(orgId, input)
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'organization.updated',
    subjectType: 'organization',
    subjectId: orgId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  return after
}
