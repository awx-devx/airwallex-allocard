import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { findProjectById } from '@/server/repositories/projects'
import { projectBudget } from '@/server/services/budget/projectProjection'
import type { BudgetDetail, BudgetSnapshot } from '@/shared/types/budget'

/** Zero projection before any ledger write. */
export function zeroProjection(updatedAt: string): BudgetSnapshot {
  return {
    approved: 0,
    committed: 0,
    actual: 0,
    remaining: 0,
    utilisationPct: 0,
    overCommitted: false,
    updatedAt,
  }
}

/** GET project budget + live projection. Missing project → 404. No budget → null + zeros. */
export async function getProjectBudget(ctx: OrgContext, projectId: string): Promise<BudgetDetail> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const budget = await findBudgetByProject(ctx, projectId)
  if (!budget) {
    return {
      budget: null,
      projection: zeroProjection(project.updatedAt),
    }
  }

  if (project.budgetSnapshot) {
    return { budget, projection: project.budgetSnapshot }
  }

  const entries = await findEntriesByProject(ctx, projectId)
  const values = projectBudget(entries)
  return {
    budget,
    projection: {
      ...values,
      updatedAt: budget.updatedAt,
    },
  }
}
