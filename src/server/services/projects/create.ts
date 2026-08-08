import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { createProject } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import type { CreateProjectInput, Project } from '@/shared/types/project'

function isMongoDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

/** Create a DRAFT project. Emits `project.created` after the write commits. */
export async function createProjectForOrg(
  ctx: OrgContext,
  input: CreateProjectInput,
): Promise<Project> {
  await connectDb()

  let project: Project
  try {
    project = await createProject(ctx, {
      name: input.name,
      code: input.code,
      description: input.description,
      ownerId: input.ownerId ?? null,
      costCentre: input.costCentre ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      cardStructure: input.cardStructure,
    })
  } catch (error) {
    if (isMongoDuplicateKey(error)) {
      throw AppError.conflict('Project code is already taken in this organisation')
    }
    throw error
  }

  await audit(ctx, {
    action: 'project.created',
    subjectType: 'project',
    subjectId: project.id,
    projectId: project.id,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: project,
  })

  await publishEvent({
    type: DomainEventType.PROJECT_CREATED,
    orgId: ctx.orgId,
    projectId: project.id,
    subjectType: 'project',
    subjectId: project.id,
    payload: {
      projectId: project.id,
      code: project.code,
      createdBy: ctx.userId,
    },
  })

  return project
}
