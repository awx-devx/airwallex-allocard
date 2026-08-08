/**
 * Projects are tenant-owned. Every method takes `OrgContext` first and filters
 * on `ctx.orgId`. Duplicate `code` within an org surfaces as Mongo duplicate-key
 * (11000) for the service layer to map to CONFLICT.
 */
import { randomUUID } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { ProjectModel } from '@/server/models/Project'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type {
  CardStructure,
  Project,
  ProjectList,
  ProjectSort,
  Workstream,
} from '@/shared/types/project'

export type CreateProjectInput = {
  name: string
  code: string
  description?: string
  ownerId?: string | null
  costCentre?: string | null
  startDate?: Date | null
  endDate?: Date | null
  cardStructure?: Partial<CardStructure>
}

export type UpdateProjectFields = {
  name?: string
  code?: string
  description?: string
  costCentre?: string | null
  startDate?: Date | null
  endDate?: Date | null
  cardStructure?: CardStructure
}

export type ListProjectsFilter = {
  status?: ProjectStatus
  ownerId?: string
  costCentre?: string
  /** When set, restrict to these project ids (MEMBER visibility filter). */
  ids?: string[]
  page?: number
  pageSize?: number
  sort?: ProjectSort
}

export type UpdateStatusExtras = {
  approvedAt?: Date | null
  launchedAt?: Date | null
  closedAt?: Date | null
}

function toWorkstreams(raw: unknown): Workstream[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((item) => {
    const row = item as Record<string, unknown>
    return { id: String(row.id), name: String(row.name) }
  })
}

function toCardStructure(raw: unknown): CardStructure {
  const row = (raw ?? {}) as Record<string, unknown>
  return {
    shared: Boolean(row.shared),
    perMember: Boolean(row.perMember),
    vendor: Boolean(row.vendor),
    oneTime: Boolean(row.oneTime),
  }
}

function nullableIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

function toProject(doc: Parameters<typeof toDomain>[0]): Project {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    name: String(raw.name),
    code: String(raw.code),
    description: String(raw.description ?? ''),
    status: raw.status as ProjectStatus,
    ownerId: raw.ownerId === null || raw.ownerId === undefined ? null : String(raw.ownerId),
    costCentre:
      raw.costCentre === null || raw.costCentre === undefined ? null : String(raw.costCentre),
    startDate: nullableIso(raw.startDate),
    endDate: nullableIso(raw.endDate),
    workstreams: toWorkstreams(raw.workstreams),
    cardStructure: toCardStructure(raw.cardStructure),
    approvedAt: nullableIso(raw.approvedAt),
    launchedAt: nullableIso(raw.launchedAt),
    closedAt: nullableIso(raw.closedAt),
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

function sortSpec(sort?: ProjectSort): Record<string, 1 | -1> {
  const key = sort ?? '-updatedAt'
  const descending = key.startsWith('-')
  const field = descending ? key.slice(1) : key
  // Secondary `_id` keeps pagination stable when primary keys tie.
  return { [field]: descending ? -1 : 1, _id: 1 }
}

export async function createProject(ctx: OrgContext, input: CreateProjectInput): Promise<Project> {
  const doc = await ProjectModel.create({
    orgId: ctx.orgId,
    name: input.name,
    code: input.code,
    description: input.description ?? '',
    status: ProjectStatus.DRAFT,
    ownerId: input.ownerId ?? null,
    costCentre: input.costCentre ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    workstreams: [],
    cardStructure: {
      shared: input.cardStructure?.shared ?? false,
      perMember: input.cardStructure?.perMember ?? false,
      vendor: input.cardStructure?.vendor ?? false,
      oneTime: input.cardStructure?.oneTime ?? false,
    },
  })
  return toProject(doc)
}

export async function findProjectById(ctx: OrgContext, projectId: string): Promise<Project | null> {
  if (!isValidObjectId(projectId)) {
    return null
  }
  const doc = await ProjectModel.findOne({ _id: projectId, orgId: ctx.orgId }).lean().exec()
  return doc ? toProject(doc) : null
}

export async function listProjects(
  ctx: OrgContext,
  filter: ListProjectsFilter = {},
): Promise<ProjectList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.status !== undefined) query.status = filter.status
  if (filter.ownerId !== undefined) query.ownerId = filter.ownerId
  if (filter.costCentre !== undefined) query.costCentre = filter.costCentre
  if (filter.ids !== undefined) {
    const objectIds = filter.ids.filter((id) => isValidObjectId(id))
    query._id = { $in: objectIds }
  }

  const [total, docs] = await Promise.all([
    ProjectModel.countDocuments(query).exec(),
    ProjectModel.find(query)
      .sort(sortSpec(filter.sort))
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toProject(doc)),
    page,
    pageSize,
    total,
  }
}

export async function updateProject(
  ctx: OrgContext,
  projectId: string,
  patch: UpdateProjectFields,
): Promise<Project | null> {
  if (!isValidObjectId(projectId)) {
    return null
  }

  const $set: Record<string, unknown> = {}
  if (patch.name !== undefined) $set.name = patch.name
  if (patch.code !== undefined) $set.code = patch.code
  if (patch.description !== undefined) $set.description = patch.description
  if (patch.costCentre !== undefined) $set.costCentre = patch.costCentre
  if (patch.startDate !== undefined) $set.startDate = patch.startDate
  if (patch.endDate !== undefined) $set.endDate = patch.endDate
  if (patch.cardStructure !== undefined) $set.cardStructure = patch.cardStructure

  if (Object.keys($set).length === 0) {
    return findProjectById(ctx, projectId)
  }

  const doc = await ProjectModel.findOneAndUpdate(
    { _id: projectId, orgId: ctx.orgId },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProject(doc) : null
}

/**
 * Conditional status update for concurrency: only succeeds when the project is
 * still in `fromStatus`. Returns null if missing or status already changed.
 */
export async function updateStatus(
  ctx: OrgContext,
  projectId: string,
  fromStatus: ProjectStatus,
  toStatus: ProjectStatus,
  extras: UpdateStatusExtras = {},
): Promise<Project | null> {
  if (!isValidObjectId(projectId)) {
    return null
  }

  const $set: Record<string, unknown> = { status: toStatus }
  if (extras.approvedAt !== undefined) $set.approvedAt = extras.approvedAt
  if (extras.launchedAt !== undefined) $set.launchedAt = extras.launchedAt
  if (extras.closedAt !== undefined) $set.closedAt = extras.closedAt

  const doc = await ProjectModel.findOneAndUpdate(
    { _id: projectId, orgId: ctx.orgId, status: fromStatus },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProject(doc) : null
}

export async function changeOwner(
  ctx: OrgContext,
  projectId: string,
  ownerId: string,
): Promise<Project | null> {
  if (!isValidObjectId(projectId)) {
    return null
  }
  const doc = await ProjectModel.findOneAndUpdate(
    { _id: projectId, orgId: ctx.orgId },
    { $set: { ownerId } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toProject(doc) : null
}

export async function addWorkstream(
  ctx: OrgContext,
  projectId: string,
  name: string,
): Promise<Workstream | null> {
  if (!isValidObjectId(projectId)) {
    return null
  }
  const workstream: Workstream = { id: randomUUID(), name }
  const doc = await ProjectModel.findOneAndUpdate(
    { _id: projectId, orgId: ctx.orgId },
    { $push: { workstreams: workstream } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  if (!doc) {
    return null
  }
  return workstream
}

export async function updateWorkstream(
  ctx: OrgContext,
  projectId: string,
  workstreamId: string,
  name: string,
): Promise<Workstream | null> {
  if (!isValidObjectId(projectId)) {
    return null
  }
  const doc = await ProjectModel.findOneAndUpdate(
    {
      _id: projectId,
      orgId: ctx.orgId,
      'workstreams.id': workstreamId,
    },
    { $set: { 'workstreams.$.name': name } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  if (!doc) {
    return null
  }
  const updated = toProject(doc).workstreams.find((ws) => ws.id === workstreamId)
  return updated ?? null
}

export async function deleteWorkstream(
  ctx: OrgContext,
  projectId: string,
  workstreamId: string,
): Promise<boolean> {
  if (!isValidObjectId(projectId)) {
    return false
  }
  const doc = await ProjectModel.findOneAndUpdate(
    {
      _id: projectId,
      orgId: ctx.orgId,
      'workstreams.id': workstreamId,
    },
    { $pull: { workstreams: { id: workstreamId } } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc !== null
}
