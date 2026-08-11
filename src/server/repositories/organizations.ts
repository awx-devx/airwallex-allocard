/**
 * Organizations are top-level tenants. Lookups are by id/slug, not scoped through
 * another org's `OrgContext`. Membership checks belong in services.
 */
import { isValidObjectId } from 'mongoose'
import { OrganizationModel } from '@/server/models/Organization'
import { toDomain } from '@/server/models/base'
import type { Organization, OrganizationSettings } from '@/shared/types/organization'

export type CreateOrganizationInput = {
  name: string
  slug: string
  country: string
  baseCurrency: string
  costCentres?: string[]
  settings?: OrganizationSettings
  airwallexAccountId?: string | null
  createdBy: string
}

export type UpdateOrganizationInput = {
  name?: string
  country?: string
  baseCurrency?: string
  costCentres?: string[]
  settings?: OrganizationSettings
}

function toOrganization(doc: Parameters<typeof toDomain>[0]): Organization {
  const raw = toDomain<Record<string, unknown>>(doc)
  const settingsRaw = (raw.settings ?? {}) as Record<string, unknown>
  const notifications =
    settingsRaw.notifications && typeof settingsRaw.notifications === 'object'
      ? (settingsRaw.notifications as Record<string, boolean>)
      : {}

  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    country: String(raw.country),
    baseCurrency: String(raw.baseCurrency),
    costCentres: Array.isArray(raw.costCentres) ? (raw.costCentres as string[]) : [],
    settings: {
      defaultApprovalPolicy:
        settingsRaw.defaultApprovalPolicy === undefined
          ? null
          : (settingsRaw.defaultApprovalPolicy as string | null),
      notifications,
    },
    airwallexAccountId:
      raw.airwallexAccountId === undefined || raw.airwallexAccountId === null
        ? null
        : String(raw.airwallexAccountId),
    createdAt: String(raw.createdAt),
  }
}

export async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  const doc = await OrganizationModel.create({
    name: input.name,
    slug: input.slug,
    country: input.country,
    baseCurrency: input.baseCurrency,
    costCentres: input.costCentres ?? [],
    settings: input.settings ?? { defaultApprovalPolicy: null, notifications: {} },
    airwallexAccountId: input.airwallexAccountId ?? null,
    createdBy: input.createdBy,
  })
  return toOrganization(doc)
}

export async function findOrganizationById(orgId: string): Promise<Organization | null> {
  if (!isValidObjectId(orgId)) {
    return null
  }
  const doc = await OrganizationModel.findById(orgId).lean().exec()
  return doc ? toOrganization(doc) : null
}

export async function findOrganizationBySlug(slug: string): Promise<Organization | null> {
  const doc = await OrganizationModel.findOne({ slug: slug.toLowerCase() }).lean().exec()
  return doc ? toOrganization(doc) : null
}

export async function findOrganizationsByIds(orgIds: string[]): Promise<Organization[]> {
  const ids = orgIds.filter((id) => isValidObjectId(id))
  if (ids.length === 0) {
    return []
  }
  const docs = await OrganizationModel.find({ _id: { $in: ids } })
    .lean()
    .exec()
  return docs.map((doc) => toOrganization(doc))
}

/**
 * Worker sweeps iterate every tenant. Organisations are top-level (no `orgId`
 * filter) — this is the intentional cross-tenant read for scheduled jobs.
 */
export async function listAllOrganizations(): Promise<Organization[]> {
  const docs = await OrganizationModel.find({}).lean().exec()
  return docs.map((doc) => toOrganization(doc))
}

export async function updateOrganization(
  orgId: string,
  patch: UpdateOrganizationInput,
): Promise<Organization | null> {
  if (!isValidObjectId(orgId)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  if (patch.name !== undefined) $set.name = patch.name
  if (patch.country !== undefined) $set.country = patch.country
  if (patch.baseCurrency !== undefined) $set.baseCurrency = patch.baseCurrency
  if (patch.costCentres !== undefined) $set.costCentres = patch.costCentres
  if (patch.settings !== undefined) $set.settings = patch.settings

  if (Object.keys($set).length === 0) {
    return findOrganizationById(orgId)
  }

  const doc = await OrganizationModel.findByIdAndUpdate(
    orgId,
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toOrganization(doc) : null
}
