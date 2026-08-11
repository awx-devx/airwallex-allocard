/**
 * Budget entries are append-only and tenant-owned. Every method takes
 * `OrgContext` first. Amounts are never updated in place.
 */
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import type { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type { BudgetEntry, BudgetEntryList } from '@/shared/types/budget'

export type AppendBudgetEntryInput = {
  projectId: string
  type: BudgetEntryType
  amount: number
  currency: string
  sourceType: BudgetEntrySourceType
  sourceId: string
  createdBy: string
  categoryId?: string | null
  lifecycleId?: string | null
  note?: string | null
}

export type ListBudgetEntriesFilter = {
  type?: BudgetEntryType
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

function toEntry(doc: Parameters<typeof toDomain>[0]): BudgetEntry {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    categoryId: raw.categoryId == null ? null : String(raw.categoryId),
    type: raw.type as BudgetEntryType,
    amount: Number(raw.amount),
    currency: String(raw.currency),
    sourceType: raw.sourceType as BudgetEntrySourceType,
    sourceId: String(raw.sourceId),
    lifecycleId: raw.lifecycleId == null ? null : String(raw.lifecycleId),
    createdBy: String(raw.createdBy),
    note: raw.note == null ? null : String(raw.note),
    createdAt: String(raw.createdAt),
  }
}

/** Insert-only. Never updates amount or any other field of an existing entry. */
export async function appendEntry(
  ctx: OrgContext,
  input: AppendBudgetEntryInput,
): Promise<BudgetEntry> {
  const doc = await BudgetEntryModel.create({
    orgId: ctx.orgId,
    projectId: input.projectId,
    categoryId: input.categoryId === undefined ? null : input.categoryId,
    type: input.type,
    amount: input.amount,
    currency: input.currency,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    lifecycleId: input.lifecycleId === undefined ? null : input.lifecycleId,
    createdBy: input.createdBy,
    note: input.note === undefined ? null : input.note,
  })
  return toEntry(doc)
}

export async function listEntries(
  ctx: OrgContext,
  projectId: string,
  filter: ListBudgetEntriesFilter = {},
): Promise<BudgetEntryList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId, projectId }
  if (filter.type !== undefined) query.type = filter.type
  if (filter.from !== undefined || filter.to !== undefined) {
    const createdAt: Record<string, Date> = {}
    if (filter.from !== undefined) createdAt.$gte = filter.from
    if (filter.to !== undefined) createdAt.$lte = filter.to
    query.createdAt = createdAt
  }

  const [total, docs] = await Promise.all([
    BudgetEntryModel.countDocuments(query).exec(),
    BudgetEntryModel.find(query)
      .sort({ createdAt: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toEntry(doc)),
    page,
    pageSize,
    total,
  }
}

/** All entries for a project (oldest first) — used by ledger recompute. */
export async function findEntriesByProject(
  ctx: OrgContext,
  projectId: string,
): Promise<BudgetEntry[]> {
  const docs = await BudgetEntryModel.find({ orgId: ctx.orgId, projectId })
    .sort({ createdAt: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toEntry(doc))
}

/** All entries for a lifecycle (oldest first) — used by ledger mapping convergence. */
export async function findEntriesByLifecycleId(
  ctx: OrgContext,
  projectId: string,
  lifecycleId: string,
): Promise<BudgetEntry[]> {
  const docs = await BudgetEntryModel.find({
    orgId: ctx.orgId,
    projectId,
    lifecycleId,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean()
    .exec()
  return docs.map((doc) => toEntry(doc))
}

export async function countEntriesReferencingCategory(
  ctx: OrgContext,
  projectId: string,
  categoryId: string,
): Promise<number> {
  return BudgetEntryModel.countDocuments({
    orgId: ctx.orgId,
    projectId,
    categoryId,
  }).exec()
}

export type IterateBudgetEntriesFilter = {
  projectId?: string
  projectIds?: string[]
  from?: Date
  to?: Date
}

/** Streaming iterate (oldest first) for CSV export — does not buffer the full set. */
export async function* iterateEntries(
  ctx: OrgContext,
  filter: IterateBudgetEntriesFilter = {},
): AsyncGenerator<BudgetEntry, void, unknown> {
  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.projectId !== undefined) query.projectId = filter.projectId
  if (filter.projectIds !== undefined) query.projectId = { $in: filter.projectIds }
  if (filter.from !== undefined || filter.to !== undefined) {
    const createdAt: Record<string, Date> = {}
    if (filter.from !== undefined) createdAt.$gte = filter.from
    if (filter.to !== undefined) createdAt.$lte = filter.to
    query.createdAt = createdAt
  }

  const cursor = BudgetEntryModel.find(query).sort({ createdAt: 1, _id: 1 }).lean().cursor()
  for await (const doc of cursor) {
    yield toEntry(doc)
  }
}
