/**
 * Budgets are tenant-owned (one per project). Every method takes `OrgContext`
 * first and filters on `ctx.orgId`.
 */
import { randomUUID } from 'node:crypto'
import { isValidObjectId } from 'mongoose'
import { BudgetModel } from '@/server/models/Budget'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import { DEFAULT_BUDGET_THRESHOLD_PCTS } from '@/shared/schemas/budget'
import type { Budget, BudgetCategory } from '@/shared/types/budget'

export type UpsertBudgetFieldsInput = {
  currency: string
  approvedAmount: number
  formula?: string | null
  thresholdPcts?: number[]
}

export type AddBudgetCategoryInput = {
  name: string
  allocated: number
  workstreamId?: string | null
  formula?: string | null
}

export type UpdateBudgetCategoryFields = {
  name?: string
  allocated?: number
  workstreamId?: string | null
  formula?: string | null
}

function toCategories(raw: unknown): BudgetCategory[] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((item) => {
    const row = item as Record<string, unknown>
    return {
      id: String(row.id),
      name: String(row.name),
      workstreamId: row.workstreamId == null ? null : String(row.workstreamId),
      allocated: Number(row.allocated),
      formula: row.formula == null ? null : String(row.formula),
    }
  })
}

function toBudget(doc: Parameters<typeof toDomain>[0]): Budget {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    projectId: String(raw.projectId),
    currency: String(raw.currency),
    approvedAmount: Number(raw.approvedAmount),
    formula: raw.formula == null ? null : String(raw.formula),
    categories: toCategories(raw.categories),
    thresholdPcts: Array.isArray(raw.thresholdPcts)
      ? raw.thresholdPcts.map((n) => Number(n))
      : [...DEFAULT_BUDGET_THRESHOLD_PCTS],
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  }
}

export async function findBudgetByProject(
  ctx: OrgContext,
  projectId: string,
): Promise<Budget | null> {
  const doc = await BudgetModel.findOne({ orgId: ctx.orgId, projectId }).lean().exec()
  return doc ? toBudget(doc) : null
}

export async function findBudgetById(ctx: OrgContext, budgetId: string): Promise<Budget | null> {
  if (!isValidObjectId(budgetId)) {
    return null
  }
  const doc = await BudgetModel.findOne({ _id: budgetId, orgId: ctx.orgId }).lean().exec()
  return doc ? toBudget(doc) : null
}

/**
 * Create-or-update header fields for a project's budget.
 * Does not touch categories. Always returns the budget after write.
 */
export async function upsertBudgetFields(
  ctx: OrgContext,
  projectId: string,
  input: UpsertBudgetFieldsInput,
): Promise<Budget> {
  const $set: Record<string, unknown> = {
    currency: input.currency,
    approvedAmount: input.approvedAmount,
    formula: input.formula === undefined ? null : input.formula,
    thresholdPcts: input.thresholdPcts ?? [...DEFAULT_BUDGET_THRESHOLD_PCTS],
  }

  const doc = await BudgetModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId },
    {
      $set,
      $setOnInsert: {
        orgId: ctx.orgId,
        projectId,
        categories: [],
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
    .lean()
    .exec()

  if (!doc) {
    throw new Error('upsertBudgetFields returned null after upsert')
  }
  return toBudget(doc)
}

export async function replaceCategories(
  ctx: OrgContext,
  projectId: string,
  categories: BudgetCategory[],
): Promise<Budget | null> {
  const normalised = categories.map((category) => ({
    id: category.id,
    name: category.name,
    workstreamId: category.workstreamId ?? null,
    allocated: category.allocated,
    formula: category.formula ?? null,
  }))

  const doc = await BudgetModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId },
    { $set: { categories: normalised } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc ? toBudget(doc) : null
}

export async function addCategory(
  ctx: OrgContext,
  projectId: string,
  input: AddBudgetCategoryInput,
): Promise<BudgetCategory | null> {
  const category: BudgetCategory = {
    id: randomUUID(),
    name: input.name,
    workstreamId: input.workstreamId === undefined ? null : input.workstreamId,
    allocated: input.allocated,
    formula: input.formula === undefined ? null : input.formula,
  }

  const doc = await BudgetModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId },
    { $push: { categories: category } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  if (!doc) {
    return null
  }
  return category
}

export async function updateCategory(
  ctx: OrgContext,
  projectId: string,
  categoryId: string,
  patch: UpdateBudgetCategoryFields,
): Promise<BudgetCategory | null> {
  const $set: Record<string, unknown> = {}
  if (patch.name !== undefined) $set['categories.$.name'] = patch.name
  if (patch.allocated !== undefined) $set['categories.$.allocated'] = patch.allocated
  if (patch.workstreamId !== undefined) $set['categories.$.workstreamId'] = patch.workstreamId
  if (patch.formula !== undefined) $set['categories.$.formula'] = patch.formula

  if (Object.keys($set).length === 0) {
    const budget = await findBudgetByProject(ctx, projectId)
    return budget?.categories.find((c) => c.id === categoryId) ?? null
  }

  const doc = await BudgetModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId, 'categories.id': categoryId },
    { $set },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  if (!doc) {
    return null
  }
  return toBudget(doc).categories.find((c) => c.id === categoryId) ?? null
}

export async function deleteCategory(
  ctx: OrgContext,
  projectId: string,
  categoryId: string,
): Promise<boolean> {
  const doc = await BudgetModel.findOneAndUpdate(
    { orgId: ctx.orgId, projectId, 'categories.id': categoryId },
    { $pull: { categories: { id: categoryId } } },
    { returnDocument: 'after' },
  )
    .lean()
    .exec()
  return doc !== null
}
