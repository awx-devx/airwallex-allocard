import { randomBytes } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import { audit } from '@/server/services/audit/log'
import { ensureOrgDelegateCardholder } from '@/server/services/cardholders/ensure'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { createMembership } from '@/server/repositories/memberships'
import { createOrganization, findOrganizationBySlug } from '@/server/repositories/organizations'
import { findUserById, updateUser } from '@/server/repositories/users'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'
import type { CreateOrganizationInput, Organization } from '@/shared/types/organization'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

/** Derive a URL slug from an org name. */
export function deriveSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
  return base.length > 0 ? base : `org-${randomBytes(3).toString('hex')}`
}

async function allocateSlug(preferred: string, explicit: boolean): Promise<string> {
  const existing = await findOrganizationBySlug(preferred)
  if (!existing) {
    return preferred
  }
  if (explicit) {
    throw AppError.conflict('Organisation slug is already taken')
  }

  for (let i = 0; i < 5; i += 1) {
    const suffix = randomBytes(2).toString('hex')
    const candidate = `${preferred.slice(0, Math.max(1, 64 - suffix.length - 1))}-${suffix}`
    if (!(await findOrganizationBySlug(candidate))) {
      return candidate
    }
  }
  throw AppError.conflict('Unable to allocate organisation slug')
}

/**
 * Create an organisation, make the caller OWNER, and seed role templates.
 * Allowed before onboarding — this is the create-org half of the onboarding fork.
 */
export async function createOrganizationForUser(
  userId: string,
  input: CreateOrganizationInput,
): Promise<Organization> {
  await connectDb()

  const user = await findUserById(userId)
  if (!user) {
    throw AppError.notFound()
  }

  const explicitSlug = input.slug !== undefined
  const slug = await allocateSlug(input.slug ?? deriveSlug(input.name), explicitSlug)

  let org: Organization
  try {
    org = await createOrganization({
      name: input.name,
      slug,
      country: input.country,
      baseCurrency: input.baseCurrency,
      costCentres: input.costCentres,
      createdBy: userId,
    })
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict('Organisation slug is already taken')
    }
    throw error
  }

  const ctx = { orgId: org.id, userId, orgRole: OrgRole.OWNER }
  await createMembership(ctx, { userId, orgRole: OrgRole.OWNER })

  if (!user.defaultOrgId) {
    await updateUser(userId, { defaultOrgId: org.id })
  }

  await seedRoleTemplates(org.id)

  try {
    await ensureOrgDelegateCardholder(ctx)
  } catch {
    // Swallow — card create will ensure the org DELEGATE later.
  }

  await audit(ctx, {
    action: 'organization.created',
    subjectType: 'organization',
    subjectId: org.id,
    actorType: ActorType.USER,
    actorId: userId,
    after: org,
  })

  await publishEvent({
    type: DomainEventType.ORGANIZATION_CREATED,
    orgId: org.id,
    subjectType: 'organization',
    subjectId: org.id,
    payload: {
      organizationId: org.id,
      createdBy: userId,
      slug: org.slug,
    },
  })

  return org
}
