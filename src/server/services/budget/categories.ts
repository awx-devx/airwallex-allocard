import { FormulaError, evaluateFormula } from '@/server/lib/formula'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { countEntriesReferencingCategory } from '@/server/repositories/budgetEntries'
import {
  addCategory,
  deleteCategory as deleteCategoryRecord,
  findBudgetByProject,
  updateCategory as updateCategoryRecord,
} from '@/server/repositories/budgets'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import type {
  Budget,
  BudgetCategory,
  CreateBudgetCategoryInput,
  UpdateBudgetCategoryInput,
} from '@/shared/types/budget'

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  return project
}

async function requireBudget(ctx: OrgContext, projectId: string): Promise<Budget> {
  const budget = await findBudgetByProject(ctx, projectId)
  if (!budget) {
    throw AppError.notFound()
  }
  return budget
}

function assertWorkstreamExists(
  projectWorkstreamIds: Set<string>,
  workstreamId: string | null | undefined,
): void {
  if (workstreamId == null) {
    return
  }
  if (!projectWorkstreamIds.has(workstreamId)) {
    throw AppError.validationFailed({
      workstreamId: ['Workstream does not exist on this project'],
    })
  }
}

function formulaContext(budget: Budget): Record<string, number> {
  return { approvedAmount: budget.approvedAmount }
}

function resolveAllocated(
  budget: Budget,
  allocated: number,
  formula: string | null | undefined,
): { allocated: number; formula: string | null } {
  if (formula == null || formula === '') {
    return { allocated, formula: formula === '' ? null : (formula ?? null) }
  }

  try {
    const value = evaluateFormula(formula, formulaContext(budget))
    if (value < 0) {
      throw AppError.validationFailed({
        formula: ['Formula must evaluate to a nonnegative integer'],
      })
    }
    return { allocated: value, formula }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    const message = error instanceof FormulaError ? error.message : 'Invalid formula'
    throw AppError.validationFailed({ formula: [message] })
  }
}

function assertWithinApproved(budget: Budget, categories: BudgetCategory[]): void {
  const sum = categories.reduce((total, category) => total + category.allocated, 0)
  if (sum > budget.approvedAmount) {
    throw AppError.validationFailed({
      allocated: [
        `Category allocations (${sum}) exceed approved amount (${budget.approvedAmount})`,
      ],
    })
  }
}

/** List budget categories. */
export async function listBudgetCategories(
  ctx: OrgContext,
  projectId: string,
): Promise<BudgetCategory[]> {
  await connectDb()
  await requireProject(ctx, projectId)
  const budget = await findBudgetByProject(ctx, projectId)
  return budget?.categories ?? []
}

/** Create a category. Formula wins over allocated when both are set. */
export async function createBudgetCategory(
  ctx: OrgContext,
  projectId: string,
  input: CreateBudgetCategoryInput,
): Promise<BudgetCategory> {
  await connectDb()
  const project = await requireProject(ctx, projectId)
  const budget = await requireBudget(ctx, projectId)

  assertWorkstreamExists(new Set(project.workstreams.map((ws) => ws.id)), input.workstreamId)

  const resolved = resolveAllocated(budget, input.allocated, input.formula)
  assertWithinApproved(budget, [
    ...budget.categories,
    {
      id: 'pending',
      name: input.name,
      workstreamId: input.workstreamId ?? null,
      allocated: resolved.allocated,
      formula: resolved.formula,
    },
  ])

  const category = await addCategory(ctx, projectId, {
    name: input.name,
    allocated: resolved.allocated,
    workstreamId: input.workstreamId,
    formula: resolved.formula,
  })
  if (!category) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'budget.category_created',
    subjectType: 'budgetCategory',
    subjectId: category.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: category,
  })

  return category
}

/** Update a category. */
export async function updateBudgetCategory(
  ctx: OrgContext,
  projectId: string,
  categoryId: string,
  input: UpdateBudgetCategoryInput,
): Promise<BudgetCategory> {
  await connectDb()
  const project = await requireProject(ctx, projectId)
  const budget = await requireBudget(ctx, projectId)
  const before = budget.categories.find((category) => category.id === categoryId)
  if (!before) {
    throw AppError.notFound()
  }

  if (input.workstreamId !== undefined) {
    assertWorkstreamExists(new Set(project.workstreams.map((ws) => ws.id)), input.workstreamId)
  }

  const nextFormula = input.formula !== undefined ? input.formula : before.formula
  const nextAllocatedInput = input.allocated !== undefined ? input.allocated : before.allocated

  const resolved =
    input.formula !== undefined || input.allocated !== undefined
      ? resolveAllocated(budget, nextAllocatedInput, nextFormula)
      : { allocated: before.allocated, formula: before.formula ?? null }

  const nextCategories = budget.categories.map((category) =>
    category.id === categoryId
      ? {
          ...category,
          name: input.name ?? category.name,
          workstreamId:
            input.workstreamId !== undefined ? input.workstreamId : category.workstreamId,
          allocated: resolved.allocated,
          formula: resolved.formula,
        }
      : category,
  )
  assertWithinApproved(budget, nextCategories)

  const after = await updateCategoryRecord(ctx, projectId, categoryId, {
    name: input.name,
    workstreamId: input.workstreamId,
    ...(input.formula !== undefined || input.allocated !== undefined
      ? { allocated: resolved.allocated, formula: resolved.formula }
      : {}),
  })
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'budget.category_updated',
    subjectType: 'budgetCategory',
    subjectId: categoryId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
    after,
  })

  return after
}

/** Delete a category. Rejected if any ledger entry references it. */
export async function deleteBudgetCategory(
  ctx: OrgContext,
  projectId: string,
  categoryId: string,
): Promise<void> {
  await connectDb()
  await requireProject(ctx, projectId)
  const budget = await requireBudget(ctx, projectId)
  const before = budget.categories.find((category) => category.id === categoryId)
  if (!before) {
    throw AppError.notFound()
  }

  const refs = await countEntriesReferencingCategory(ctx, projectId, categoryId)
  if (refs > 0) {
    throw AppError.conflict('Category is referenced by budget entries')
  }

  const deleted = await deleteCategoryRecord(ctx, projectId, categoryId)
  if (!deleted) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: 'budget.category_deleted',
    subjectType: 'budgetCategory',
    subjectId: categoryId,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before,
  })
}
