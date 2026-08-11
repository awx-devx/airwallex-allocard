/**
 * Closure status — GET progress for a CLOSING project.
 * Polls settle (pending auth clear) before returning.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findByProject as findClosureByProject } from '@/server/repositories/projectClosures'
import { findProjectById } from '@/server/repositories/projects'
import { settleClosure } from '@/server/services/closure/settle'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { ClosureStatus, ProjectClosure } from '@/shared/types/closure'
import type { Project } from '@/shared/types/project'

export function toClosureStatus(project: Project, closure: ProjectClosure): ClosureStatus {
  return {
    projectId: project.id,
    projectStatus: project.status,
    currentStep: closure.currentStep,
    steps: closure.steps,
    resumable: project.status === ProjectStatus.CLOSING && closure.completedAt === null,
  }
}

/**
 * Return closure progress. Project must be CLOSING with a closure doc.
 * Invokes settle so a status poll can clear SETTLE when auths finish.
 */
export async function getClosureStatus(ctx: OrgContext, projectId: string): Promise<ClosureStatus> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  if (project.status !== ProjectStatus.CLOSING) {
    throw AppError.conflict(
      `Project must be CLOSING to read closure status (was ${project.status})`,
    )
  }

  const existing = await findClosureByProject(ctx, projectId)
  if (!existing) {
    throw AppError.notFound()
  }

  const closure = await settleClosure(ctx, projectId)
  return toClosureStatus(project, closure)
}
