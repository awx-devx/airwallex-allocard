import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findOrganizationById } from '@/server/repositories/organizations'
import type { Organization } from '@/shared/types/organization'

/**
 * Read an organisation the caller is an ACTIVE member of.
 * Path id must match `ctx.orgId` — cross-org → 404.
 */
export async function getOrganization(ctx: OrgContext, orgId: string): Promise<Organization> {
  await connectDb()

  if (ctx.orgId !== orgId) {
    throw AppError.notFound()
  }

  const org = await findOrganizationById(orgId)
  if (!org) {
    throw AppError.notFound()
  }
  return org
}
