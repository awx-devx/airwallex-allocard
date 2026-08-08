import { connectDb } from '@/server/db/connect'
import { AppError, type FieldErrors } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findProjectById,
  updateProject as updateProjectRecord,
  type UpdateProjectFields,
} from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { Project, UpdateProjectInput } from '@/shared/types/project'

type EditableField = keyof UpdateProjectInput

const ALL_FIELDS = [
  'name',
  'code',
  'description',
  'costCentre',
  'startDate',
  'endDate',
  'cardStructure',
] as const satisfies readonly EditableField[]

/**
 * Fields editable via PATCH per status.
 * Terminal statuses have an empty set — PATCH is rejected entirely.
 * Non-terminal: all `updateProjectInput` fields (wizard + post-launch tweaks).
 */
const EDITABLE_BY_STATUS: Record<ProjectStatus, readonly EditableField[]> = {
  [ProjectStatus.DRAFT]: ALL_FIELDS,
  [ProjectStatus.PENDING_APPROVAL]: ALL_FIELDS,
  [ProjectStatus.ACTIVE]: ALL_FIELDS,
  [ProjectStatus.CLOSING]: ALL_FIELDS,
  [ProjectStatus.CLOSED]: [],
  [ProjectStatus.ARCHIVED]: [],
  [ProjectStatus.CANCELLED]: [],
}

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

function assertEditable(status: ProjectStatus, input: UpdateProjectInput): void {
  const allowed = new Set(EDITABLE_BY_STATUS[status])
  if (allowed.size === 0) {
    throw AppError.conflict('Project cannot be edited in its current status')
  }

  const fieldErrors: FieldErrors = {}
  for (const key of ALL_FIELDS) {
    if (input[key] !== undefined && !allowed.has(key)) {
      fieldErrors[key] = ['Not editable in the current project status']
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    throw AppError.validationFailed(fieldErrors)
  }
}

function toRepoPatch(input: UpdateProjectInput): UpdateProjectFields {
  const patch: UpdateProjectFields = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.code !== undefined) patch.code = input.code
  if (input.description !== undefined) patch.description = input.description
  if (input.costCentre !== undefined) patch.costCentre = input.costCentre
  if (input.startDate !== undefined) {
    patch.startDate = input.startDate === null ? null : new Date(input.startDate)
  }
  if (input.endDate !== undefined) {
    patch.endDate = input.endDate === null ? null : new Date(input.endDate)
  }
  if (input.cardStructure !== undefined) patch.cardStructure = input.cardStructure
  return patch
}

/** Partial project update. `project.edit` must already have passed. */
export async function updateProjectForOrg(
  ctx: OrgContext,
  projectId: string,
  input: UpdateProjectInput,
): Promise<Project> {
  await connectDb()

  const before = await findProjectById(ctx, projectId)
  if (!before) {
    throw AppError.notFound()
  }

  assertEditable(before.status, input)

  let after: Project | null
  try {
    after = await updateProjectRecord(ctx, projectId, toRepoPatch(input))
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict('Project code is already taken in this organisation')
    }
    throw error
  }

  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'project.updated',
    subjectType: 'project',
    subjectId: projectId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  return after
}
