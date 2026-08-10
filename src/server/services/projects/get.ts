import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { countNonClosedByProject } from '@/server/repositories/cards'
import { findProjectById } from '@/server/repositories/projects'
import type { Project, ProjectDetail, ProjectOverview } from '@/shared/types/project'

/** Overview stubs until B3/B7 land remaining counts. Card count is live (non-CLOSED). */
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

async function buildProjectOverview(ctx: OrgContext, project: Project): Promise<ProjectOverview> {
  const overview = emptyProjectOverview()
  // Prefer non-CLOSED so PENDING/INACTIVE still surface and block close.
  overview.activeCardCount = await countNonClosedByProject(ctx, project.id)

  if (!project.budgetSnapshot) {
    return overview
  }

  const budget = await findBudgetByProject(ctx, project.id)
  if (!budget) {
    return overview
  }

  const { remaining, committed, actual } = project.budgetSnapshot
  return {
    ...overview,
    budgetRemaining: { amount: remaining, currency: budget.currency },
    budgetSpent: { amount: committed + actual, currency: budget.currency },
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
    overview: await buildProjectOverview(ctx, project),
  }
}
