/**
 * Closure preflight — list blockers independently.
 * `canStart === (blockers.length === 0)` (fully blocking).
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { listCards } from '@/server/repositories/cards'
import { listActiveProjectMembers } from '@/server/repositories/projectMembers'
import { findProjectById } from '@/server/repositories/projects'
import { listPurchaseRequests } from '@/server/repositories/purchaseRequests'
import { listTransactions } from '@/server/repositories/transactions'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ClosureBlockingKind } from '@/shared/enums/closureBlockingKind'
import { Permission } from '@/shared/enums/permissions'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { formatMoney } from '@/lib/money'
import type { ClosureBlockingItem, ClosurePreflight } from '@/shared/types/closure'

const AUTH_TYPES: ReadonlySet<string> = new Set([
  TransactionType.AUTHORIZATION,
  TransactionType.INCREMENTAL_AUTHORIZATION,
])

const LIST_PAGE_SIZE = 100

function moneySummary(amount: number, currency: string): string {
  return formatMoney({ amount, currency })
}

/**
 * Collect every blocker kind independently (a subject may appear under one kind only
 * via partition where kinds overlap). `canStart` is true iff the list is empty.
 */
export async function closurePreflight(
  ctx: OrgContext,
  projectId: string,
): Promise<ClosurePreflight> {
  await connectDb()

  const project = await findProjectById(ctx, projectId)
  if (!project) {
    throw AppError.notFound()
  }

  const blockers: ClosureBlockingItem[] = []
  const now = Date.now()

  const openTxs = await listTransactions(ctx, {
    projectId,
    status: TransactionStatus.AUTHORIZED,
    page: 1,
    pageSize: LIST_PAGE_SIZE,
  })
  for (const tx of openTxs.items) {
    if (AUTH_TYPES.has(tx.type)) {
      blockers.push({
        kind: ClosureBlockingKind.PENDING_AUTHORIZATION,
        subjectType: 'transaction',
        subjectId: tx.id,
        summary: `Pending authorization ${tx.id} (${moneySummary(tx.amount, tx.currency)})`,
      })
    } else {
      blockers.push({
        kind: ClosureBlockingKind.OPEN_TRANSACTION,
        subjectType: 'transaction',
        subjectId: tx.id,
        summary: `Open transaction ${tx.id} (${moneySummary(tx.amount, tx.currency)}, ${tx.type})`,
      })
    }
  }

  const requests = await listPurchaseRequests(ctx, projectId, {
    page: 1,
    pageSize: LIST_PAGE_SIZE,
  })
  for (const req of requests.items) {
    if (req.status !== PurchaseRequestStatus.PENDING) continue
    blockers.push({
      kind: ClosureBlockingKind.PENDING_REQUEST,
      subjectType: 'purchaseRequest',
      subjectId: req.id,
      summary: `Pending purchase request ${req.id} (${moneySummary(req.amount, req.currency)})`,
    })
  }

  // ACTIVE_CARD = spend-capable cards (CardStatus.ACTIVE). Operator freezes to INACTIVE
  // before start; start's FREEZE step re-freezes remaining non-CLOSED cards.
  const activeCards = await listCards(ctx, {
    projectId,
    status: CardStatus.ACTIVE,
    page: 1,
    pageSize: LIST_PAGE_SIZE,
  })
  for (const card of activeCards.items) {
    blockers.push({
      kind: ClosureBlockingKind.ACTIVE_CARD,
      subjectType: 'card',
      subjectId: card.id,
      summary: `Active card ${card.id} must be frozen before closure`,
    })
  }

  const members = await listActiveProjectMembers(ctx, projectId)
  for (const member of members) {
    const validTo = member.scope.validTo
    const validToMs = validTo !== undefined ? Date.parse(validTo) : undefined
    const expired = validToMs !== undefined && validToMs < now
    if (expired) continue

    const hasSpend = member.effectivePermissions.includes(Permission.PAYMENT_MAKE)
    const hasFutureValidTo = validToMs !== undefined && validToMs >= now
    if (!hasSpend && !hasFutureValidTo) continue

    const reasons: string[] = []
    if (hasSpend) reasons.push('spend permission')
    if (hasFutureValidTo) reasons.push(`access valid until ${validTo}`)
    blockers.push({
      kind: ClosureBlockingKind.ACTIVE_ACCESS,
      subjectType: 'projectMember',
      subjectId: member.id,
      summary: `Active access for user ${member.userId} (${reasons.join(', ')})`,
    })
  }

  return {
    projectId,
    canStart: blockers.length === 0,
    blockers,
  }
}
