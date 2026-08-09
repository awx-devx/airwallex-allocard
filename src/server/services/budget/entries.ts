import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  listEntries as listEntriesRecord,
  type ListBudgetEntriesFilter,
} from '@/server/repositories/budgetEntries'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { findProjectById } from '@/server/repositories/projects'
import { audit } from '@/server/services/audit/log'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { ActorType } from '@/shared/enums/audit'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type {
  BudgetEntry,
  BudgetEntryList,
  CreateBudgetEntryInput,
  ListBudgetEntriesQuery,
} from '@/shared/types/budget'

async function requireProject(ctx: OrgContext, projectId: string) {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }
  return project
}

/**
 * List ledger entries for a project. Query `from`/`to` are ISO strings on the wire.
 */
export async function listBudgetEntries(
  ctx: OrgContext,
  projectId: string,
  query: ListBudgetEntriesQuery,
): Promise<BudgetEntryList> {
  await connectDb()
  await requireProject(ctx, projectId)

  const filter: ListBudgetEntriesFilter = {
    type: query.type,
    page: query.page,
    pageSize: query.pageSize,
  }
  if (query.from !== undefined) filter.from = new Date(query.from)
  if (query.to !== undefined) filter.to = new Date(query.to)

  return listEntriesRecord(ctx, projectId, filter)
}

/**
 * Public manual adjustment — always ADJUSTMENT + MANUAL.
 * COMMITMENT / ACTUAL / RELEASE / APPROVAL are not creatable via this path.
 */
export async function createManualBudgetAdjustment(
  ctx: OrgContext,
  projectId: string,
  input: CreateBudgetEntryInput,
): Promise<BudgetEntry> {
  await connectDb()
  await requireProject(ctx, projectId)

  const budget = await findBudgetByProject(ctx, projectId)
  if (!budget) {
    throw AppError.notFound()
  }

  if (input.categoryId) {
    const exists = budget.categories.some((category) => category.id === input.categoryId)
    if (!exists) {
      throw AppError.validationFailed({
        categoryId: ['Category does not exist on this budget'],
      })
    }
  }

  const { entry } = await appendBudgetEntry(ctx, projectId, {
    type: BudgetEntryType.ADJUSTMENT,
    amount: input.amount,
    currency: budget.currency,
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: randomUUID(),
    createdBy: ctx.userId,
    categoryId: input.categoryId ?? null,
    note: input.note ?? null,
  })

  await audit(ctx, {
    action: 'budget.entry_created',
    subjectType: 'budgetEntry',
    subjectId: entry.id,
    projectId,
    actorType: ActorType.USER,
    actorId: ctx.userId,
    after: entry,
  })

  return entry
}
