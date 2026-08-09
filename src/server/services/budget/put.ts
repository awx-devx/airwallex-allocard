import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findBudgetByProject, upsertBudgetFields } from '@/server/repositories/budgets'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { projectBudget } from '@/server/services/budget/projectProjection'
import { ActorType } from '@/shared/enums/audit'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type { BudgetDetail, PutBudgetInput } from '@/shared/types/budget'

/**
 * PUT budget header fields and append a ledger entry so projection.approved
 * matches `approvedAmount`:
 * - delta >= 0 → APPROVAL with amount = delta
 * - delta < 0 → ADJUSTMENT with amount = delta (APPROVAL amounts stay nonnegative)
 */
export async function putProjectBudget(
  ctx: OrgContext,
  projectId: string,
  input: PutBudgetInput,
): Promise<BudgetDetail> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const before = await findBudgetByProject(ctx, projectId)
  const previousApproved = projectBudget(await findEntriesByProject(ctx, projectId)).approved
  const delta = input.approvedAmount - previousApproved

  const budget = await upsertBudgetFields(ctx, projectId, {
    currency: input.currency,
    approvedAmount: input.approvedAmount,
    formula: input.formula,
    thresholdPcts: input.thresholdPcts,
  })

  const { projection } = await appendBudgetEntry(ctx, projectId, {
    type: delta >= 0 ? BudgetEntryType.APPROVAL : BudgetEntryType.ADJUSTMENT,
    amount: delta,
    currency: input.currency,
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: budget.id,
    createdBy: ctx.userId,
    note: before ? 'budget.put' : 'budget.created',
  })

  const after = await findBudgetByProject(ctx, projectId)
  if (!after) {
    throw AppError.notFound()
  }

  await audit(ctx, {
    action: before ? 'budget.updated' : 'budget.created',
    subjectType: 'budget',
    subjectId: after.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    before: before ?? undefined,
    after,
    metadata: { delta },
  })

  return { budget: after, projection }
}
