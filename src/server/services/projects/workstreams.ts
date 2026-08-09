import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findBudgetByProject } from '@/server/repositories/budgets'
import {
  addWorkstream,
  deleteWorkstream as deleteWorkstreamRecord,
  findProjectById,
  updateWorkstream as updateWorkstreamRecord,
} from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import type {
  CreateWorkstreamInput,
  UpdateWorkstreamInput,
  Workstream,
} from '@/shared/types/project'

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  return project
}

/** List workstreams for a project. */
export async function listProjectWorkstreams(
  ctx: OrgContext,
  projectId: string,
): Promise<Workstream[]> {
  await connectDb()
  const project = await requireProject(ctx, projectId)
  return project.workstreams
}

/** Create a workstream on a project. */
export async function createProjectWorkstream(
  ctx: OrgContext,
  projectId: string,
  input: CreateWorkstreamInput,
): Promise<Workstream> {
  await connectDb()
  await requireProject(ctx, projectId)

  const workstream = await addWorkstream(ctx, projectId, input.name)
  if (!workstream) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'workstream.created',
    subjectType: 'workstream',
    subjectId: workstream.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: workstream,
  })

  return workstream
}

/** Rename a workstream. */
export async function updateProjectWorkstream(
  ctx: OrgContext,
  projectId: string,
  workstreamId: string,
  input: UpdateWorkstreamInput,
): Promise<Workstream> {
  await connectDb()
  const project = await requireProject(ctx, projectId)
  const before = project.workstreams.find((ws) => ws.id === workstreamId)
  if (!before) {
    throw AppError.notFound()
  }

  const after = await updateWorkstreamRecord(ctx, projectId, workstreamId, input.name)
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'workstream.updated',
    subjectType: 'workstream',
    subjectId: workstreamId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  return after
}

/** Delete a workstream. Rejected when a budget category references it. */
export async function deleteProjectWorkstream(
  ctx: OrgContext,
  projectId: string,
  workstreamId: string,
): Promise<void> {
  await connectDb()
  const project = await requireProject(ctx, projectId)
  const before = project.workstreams.find((ws) => ws.id === workstreamId)
  if (!before) {
    throw AppError.notFound()
  }

  const budget = await findBudgetByProject(ctx, projectId)
  if (budget?.categories.some((category) => category.workstreamId === workstreamId)) {
    throw AppError.conflict('Workstream is referenced by a budget category')
  }

  const deleted = await deleteWorkstreamRecord(ctx, projectId, workstreamId)
  if (!deleted) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'workstream.deleted',
    subjectType: 'workstream',
    subjectId: workstreamId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
  })
}
