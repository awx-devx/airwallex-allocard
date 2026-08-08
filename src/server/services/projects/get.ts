import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findProjectById } from '@/server/repositories/projects'
import type { ProjectDetail, ProjectOverview } from '@/shared/types/project'

/** Overview stubs until B3–B5/B7 land real counts. */
export function emptyProjectOverview(): ProjectOverview {
  return {
    memberCount: 0,
    activeCardCount: 0,
    pendingApprovalCount: 0,
    alertCount: 0,
    budgetRemaining: null,
    budgetSpent: null,
  }
}

/** Get a project with overview counts. Cross-org → 404. */
export async function getProjectDetail(ctx: OrgContext, projectId: string): Promise<ProjectDetail> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  return {
    ...project,
    overview: emptyProjectOverview(),
  }
}
