/**
 * B9.4 — Project budget-vs-actual report.
 *
 * Totals from ledger projection (`projectBudget`). Category/member actuals join
 * ACTUAL ledger entries → transactions (lifecycleId) → card → categoryId /
 * cardholder.userId. Prefer ledger+transactions over summing transactions alone
 * so refunds (negative ACTUAL) and out-of-order clears stay consistent with
 * `budget:verify`.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { findCardholderById } from '@/server/repositories/cardholders'
import { listCards } from '@/server/repositories/cards'
import { findOrganizationById } from '@/server/repositories/organizations'
import { findProjectById } from '@/server/repositories/projects'
import { iterateTransactions } from '@/server/repositories/transactions'
import { projectBudget } from '@/server/services/budget/projectProjection'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type { BudgetEntry } from '@/shared/types/budget'
import type { ProjectReport } from '@/shared/types/report'

async function lifecycleToCardId(ctx: OrgContext, projectId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for await (const tx of iterateTransactions(ctx, { projectId })) {
    if (!map.has(tx.lifecycleId)) {
      map.set(tx.lifecycleId, tx.cardId)
    }
  }
  return map
}

function actualEntries(entries: readonly BudgetEntry[]): BudgetEntry[] {
  return entries.filter((e) => e.type === BudgetEntryType.ACTUAL)
}

/**
 * Build project report. Missing / cross-org project → 404.
 * Currency = budget currency when present, else org.baseCurrency.
 */
export async function getProjectReport(ctx: OrgContext, projectId: string): Promise<ProjectReport> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const [budget, entries, org] = await Promise.all([
    findBudgetByProject(ctx, projectId),
    findEntriesByProject(ctx, projectId),
    findOrganizationById(ctx.orgId),
  ])

  const currency = budget?.currency ?? org?.baseCurrency ?? 'USD'
  // Always recompute from ledger so totals match budget:verify / projectBudget.
  const values = projectBudget(entries)

  const lifecycleCardIds = await lifecycleToCardId(ctx, projectId)
  const cardPage = await listCards(ctx, { projectId, pageSize: 500 })
  const cardById = new Map(cardPage.items.map((c) => [c.id, c]))

  const cardholderIds = [...new Set(cardPage.items.map((c) => c.cardholderId).filter(Boolean))]
  const cardholders = await Promise.all(cardholderIds.map((id) => findCardholderById(ctx, id)))
  const userIdByCardholderId = new Map<string, string>()
  for (const ch of cardholders) {
    if (ch?.userId) {
      userIdByCardholderId.set(ch.id, ch.userId)
    }
  }

  const categoryActual = new Map<string, number>()
  const memberActual = new Map<string, number>()

  for (const entry of actualEntries(entries)) {
    let categoryId = entry.categoryId
    let userId: string | undefined

    if (entry.lifecycleId) {
      const cardId = lifecycleCardIds.get(entry.lifecycleId)
      const card = cardId ? cardById.get(cardId) : undefined
      if (card) {
        if (categoryId == null && card.categoryId) {
          categoryId = card.categoryId
        }
        userId = userIdByCardholderId.get(card.cardholderId)
      }
    }

    if (categoryId) {
      categoryActual.set(categoryId, (categoryActual.get(categoryId) ?? 0) + entry.amount)
    }
    if (userId) {
      memberActual.set(userId, (memberActual.get(userId) ?? 0) + entry.amount)
    }
  }

  const byCategory = (budget?.categories ?? []).map((cat) => ({
    categoryId: cat.id,
    name: cat.name,
    allocated: cat.allocated,
    actual: categoryActual.get(cat.id) ?? 0,
  }))

  const byMember = [...memberActual.entries()]
    .map(([userId, actual]) => ({ userId, actual }))
    .sort((a, b) => a.userId.localeCompare(b.userId))

  return {
    projectId,
    currency,
    approved: values.approved,
    committed: values.committed,
    actual: values.actual,
    remaining: values.remaining,
    utilisationPct: values.utilisationPct,
    byCategory,
    byMember,
    generatedAt: new Date().toISOString(),
  }
}
