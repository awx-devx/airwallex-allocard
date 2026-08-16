/**
 * Unified activity feed (B9.1).
 *
 * Sources (no new collection): transactions, purchase requests (+ embedded
 * approvals), auditLogs for card.* / member.* / residual audit, ruleRuns.
 * Cursor = opaque base64url JSON `{ at, id }` — never offset pages.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import {
  decodeOpaqueCursor,
  encodeOpaqueCursor,
  type OpaqueCursorPayload,
} from '@/server/http/opaqueCursor'
import {
  projectIdsGrantingPermission,
  shouldSeeOnlyOwnRequests,
} from '@/server/http/requirePermission'
import type { OrgContext } from '@/server/http/types'
import { listAuditLogs } from '@/server/repositories/auditLogs'
import { findCardById } from '@/server/repositories/cards'
import { findCardholderById } from '@/server/repositories/cardholders'
import { findProjectMemberById } from '@/server/repositories/projectMembers'
import { findProjectById } from '@/server/repositories/projects'
import { listPurchaseRequestsForFeed } from '@/server/repositories/purchaseRequests'
import { listRuleRunsForFeed } from '@/server/repositories/ruleRuns'
import { listTransactionsForFeed } from '@/server/repositories/transactions'
import {
  purchaseRequestFeedSummary,
  transactionFeedSummary,
} from '@/server/services/activity/summaries'
import { ActorType } from '@/shared/enums/audit'
import { ActivityItemType } from '@/shared/enums/activityItemType'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { ActivityItem, ActivityPage, ListActivityQuery } from '@/shared/types/activity'

const CARD_ACTIONS = [
  'card.created',
  'card.updated',
  'card.status_changed',
  'card.pan_token_created',
] as const

const MEMBER_ACTIONS = ['member.added', 'member.updated', 'member.removed'] as const

const FETCH_LIMIT = 200

export { encodeOpaqueCursor as encodeActivityCursor, decodeOpaqueCursor as decodeActivityCursor }

function isElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

function compareDesc(a: ActivityItem, b: ActivityItem): number {
  if (a.at !== b.at) {
    return a.at < b.at ? 1 : -1
  }
  if (a.id !== b.id) {
    return a.id < b.id ? 1 : -1
  }
  return 0
}

/** True when `item` is strictly older than the cursor (at desc, id desc). */
function isBeforeCursor(item: ActivityItem, cursor: OpaqueCursorPayload): boolean {
  if (item.at !== cursor.at) {
    return item.at < cursor.at
  }
  return item.id < cursor.id
}

function truncateSummary(text: string): string {
  if (text.length <= 500) return text
  return text.slice(0, 500)
}

async function resolveAllowedProjectIds(
  ctx: OrgContext,
  projectId: string | undefined,
): Promise<string[] | undefined> {
  if (projectId !== undefined) {
    const project = await findProjectById(ctx, projectId)
    if (!project) {
      throw AppError.notFound()
    }
    return [projectId]
  }

  if (isElevated(ctx.orgRole)) {
    return undefined
  }

  const ids = await projectIdsGrantingPermission(ctx, Permission.TRANSACTION_VIEW)
  if (ids.length === 0) {
    throw AppError.permissionDenied(Permission.TRANSACTION_VIEW)
  }
  return ids
}

async function shouldFilterOwn(
  ctx: OrgContext,
  projectIds: string[] | undefined,
  singleProjectId: string | undefined,
): Promise<boolean> {
  if (isElevated(ctx.orgRole)) {
    return false
  }
  if (singleProjectId !== undefined) {
    return shouldSeeOnlyOwnRequests(ctx, singleProjectId)
  }
  // Org-wide MEMBER: OWN if every allowed project is OWN-scoped.
  if (projectIds === undefined || projectIds.length === 0) {
    return false
  }
  for (const id of projectIds) {
    if (!(await shouldSeeOnlyOwnRequests(ctx, id))) {
      return false
    }
  }
  return true
}

function ownVisible(item: ActivityItem, userId: string): boolean {
  if (item.actorId === userId) {
    return true
  }
  const payload = item.payload
  if (typeof payload.userId === 'string' && payload.userId === userId) {
    return true
  }
  if (typeof payload.requestedBy === 'string' && payload.requestedBy === userId) {
    return true
  }
  if (typeof payload.cardholderUserId === 'string' && payload.cardholderUserId === userId) {
    return true
  }
  return false
}

async function cardholderUserIdForCard(
  ctx: OrgContext,
  cardId: string,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (cache.has(cardId)) {
    return cache.get(cardId) ?? null
  }
  const card = await findCardById(ctx, cardId)
  if (!card) {
    cache.set(cardId, null)
    return null
  }
  const holder = await findCardholderById(ctx, card.cardholderId)
  const userId = holder?.userId ?? null
  cache.set(cardId, userId)
  return userId
}

async function collectItems(
  ctx: OrgContext,
  projectIds: string[] | undefined,
  singleProjectId: string | undefined,
  query: ListActivityQuery,
): Promise<ActivityItem[]> {
  const from = query.from ? new Date(query.from) : undefined
  const to = query.to ? new Date(query.to) : undefined
  const feedFilter = {
    ...(singleProjectId !== undefined
      ? { projectId: singleProjectId }
      : projectIds !== undefined
        ? { projectIds }
        : {}),
    from,
    to,
    limit: FETCH_LIMIT,
  }

  const cardUserCache = new Map<string, string | null>()
  const items: ActivityItem[] = []

  const want = (type: ActivityItemType) => query.type === undefined || query.type === type

  if (want(ActivityItemType.TRANSACTION)) {
    const txs = await listTransactionsForFeed(ctx, feedFilter)
    for (const tx of txs) {
      const cardholderUserId = await cardholderUserIdForCard(ctx, tx.cardId, cardUserCache)
      items.push({
        id: tx.id,
        orgId: tx.orgId,
        projectId: tx.projectId,
        type: ActivityItemType.TRANSACTION,
        at: tx.transactedAt,
        actorType: ActorType.AIRWALLEX,
        actorId: tx.cardId,
        subjectType: 'transaction',
        subjectId: tx.id,
        summary: truncateSummary(
          transactionFeedSummary(tx.type, tx.status, tx.amount, tx.currency, tx.merchant.name),
        ),
        payload: {
          cardId: tx.cardId,
          amount: tx.amount,
          currency: tx.currency,
          status: tx.status,
          type: tx.type,
          ...(cardholderUserId !== null ? { cardholderUserId, userId: cardholderUserId } : {}),
        },
      })
    }
  }

  if (want(ActivityItemType.PURCHASE_REQUEST) || want(ActivityItemType.APPROVAL)) {
    const requests = await listPurchaseRequestsForFeed(ctx, feedFilter)
    for (const req of requests) {
      if (want(ActivityItemType.PURCHASE_REQUEST)) {
        items.push({
          id: req.id,
          orgId: req.orgId,
          projectId: req.projectId,
          type: ActivityItemType.PURCHASE_REQUEST,
          at: req.updatedAt,
          actorType: ActorType.USER,
          actorId: req.requestedBy,
          subjectType: 'purchaseRequest',
          subjectId: req.id,
          summary: truncateSummary(
            purchaseRequestFeedSummary(req.status, req.vendor, req.amount, req.currency),
          ),
          payload: {
            status: req.status,
            amount: req.amount,
            currency: req.currency,
            requestedBy: req.requestedBy,
            userId: req.requestedBy,
          },
        })
      }
      if (want(ActivityItemType.APPROVAL)) {
        for (const [index, approval] of req.approvals.entries()) {
          items.push({
            id: `${req.id}:approval:${index}`,
            orgId: req.orgId,
            projectId: req.projectId,
            type: ActivityItemType.APPROVAL,
            at: approval.at,
            actorType: ActorType.USER,
            actorId: approval.approverId,
            subjectType: 'purchaseRequest',
            subjectId: req.id,
            summary: truncateSummary(`Approval ${approval.decision} on request ${req.vendor}`),
            payload: {
              decision: approval.decision,
              requestedBy: req.requestedBy,
              userId: req.requestedBy,
              approverId: approval.approverId,
            },
          })
        }
      }
    }
  }

  if (want(ActivityItemType.CARD)) {
    const logs = await listAuditLogs(ctx, {
      ...feedFilter,
      actions: [...CARD_ACTIONS],
      limit: FETCH_LIMIT,
    })
    for (const log of logs) {
      const cardId = log.subjectId
      const cardholderUserId =
        log.subjectType === 'card'
          ? await cardholderUserIdForCard(ctx, cardId, cardUserCache)
          : null
      items.push({
        id: log.id,
        orgId: log.orgId,
        projectId: log.projectId ?? null,
        type: ActivityItemType.CARD,
        at: log.at,
        actorType: log.actorType,
        actorId: log.actorId,
        subjectType: log.subjectType,
        subjectId: log.subjectId,
        summary: truncateSummary(log.action),
        payload: {
          action: log.action,
          ...(cardholderUserId !== null ? { cardholderUserId, userId: cardholderUserId } : {}),
        },
      })
    }
  }

  if (want(ActivityItemType.ACCESS)) {
    const logs = await listAuditLogs(ctx, {
      ...feedFilter,
      actions: [...MEMBER_ACTIONS],
      subjectType: 'projectMember',
      limit: FETCH_LIMIT,
    })
    for (const log of logs) {
      let memberUserId: string | null = null
      if (typeof log.metadata.userId === 'string') {
        memberUserId = log.metadata.userId
      } else {
        const member = await findProjectMemberById(ctx, log.subjectId)
        memberUserId = member?.userId ?? null
      }
      items.push({
        id: log.id,
        orgId: log.orgId,
        projectId: log.projectId ?? null,
        type: ActivityItemType.ACCESS,
        at: log.at,
        actorType: log.actorType,
        actorId: log.actorId,
        subjectType: log.subjectType,
        subjectId: log.subjectId,
        summary: truncateSummary(log.action),
        payload: {
          action: log.action,
          ...(memberUserId !== null ? { userId: memberUserId } : {}),
        },
      })
    }
  }

  if (want(ActivityItemType.RULE_RUN)) {
    const rows = await listRuleRunsForFeed(ctx, feedFilter)
    for (const { run, projectId } of rows) {
      items.push({
        id: run.id,
        orgId: run.orgId,
        projectId,
        type: ActivityItemType.RULE_RUN,
        at: run.startedAt,
        actorType: run.triggeredByType,
        actorId: run.triggeredBy,
        subjectType: 'ruleRun',
        subjectId: run.id,
        summary: truncateSummary(
          `Rule run ${run.status} (matched=${run.matched}) trigger=${run.triggerEvent}`,
        ),
        payload: {
          ruleId: run.ruleId,
          status: run.status,
          matched: run.matched,
        },
      })
    }
  }

  if (want(ActivityItemType.AUDIT)) {
    const logs = await listAuditLogs(ctx, {
      ...feedFilter,
      limit: FETCH_LIMIT,
    })
    const skipActions = new Set<string>([...CARD_ACTIONS, ...MEMBER_ACTIONS])
    for (const log of logs) {
      if (skipActions.has(log.action)) continue
      // Avoid duplicating purchase-request rows already emitted from the collection.
      if (log.subjectType === 'purchaseRequest') continue
      items.push({
        id: `audit:${log.id}`,
        orgId: log.orgId,
        projectId: log.projectId ?? null,
        type: ActivityItemType.AUDIT,
        at: log.at,
        actorType: log.actorType,
        actorId: log.actorId,
        subjectType: log.subjectType,
        subjectId: log.subjectId,
        summary: truncateSummary(log.action),
        payload: { action: log.action },
      })
    }
  }

  return items
}

/**
 * Org-wide or project-scoped activity page.
 * Permission: `transaction.view` (checked in route for project; resolved here for org-wide).
 */
export async function listActivity(
  ctx: OrgContext,
  query: ListActivityQuery,
): Promise<ActivityPage> {
  await connectDb()

  const singleProjectId = query.projectId
  const projectIds = await resolveAllowedProjectIds(ctx, singleProjectId)
  const onlyOwn = await shouldFilterOwn(ctx, projectIds, singleProjectId)

  let items = await collectItems(ctx, projectIds, singleProjectId, query)

  if (query.actorId !== undefined) {
    items = items.filter((item) => item.actorId === query.actorId)
  }
  if (onlyOwn) {
    items = items.filter((item) => ownVisible(item, ctx.userId))
  }

  items.sort(compareDesc)

  // Deduplicate by id (approval synthetic ids are unique; audit: prefix avoids card/access clash).
  const seen = new Set<string>()
  items = items.filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })

  if (query.cursor !== undefined) {
    const cursor = decodeOpaqueCursor(query.cursor)
    items = items.filter((item) => isBeforeCursor(item, cursor))
  }

  const limit = query.limit
  const pageItems = items.slice(0, limit)
  const nextCursor =
    items.length > limit
      ? encodeOpaqueCursor(pageItems[pageItems.length - 1]!.at, pageItems[pageItems.length - 1]!.id)
      : null

  return { items: pageItems, nextCursor }
}
