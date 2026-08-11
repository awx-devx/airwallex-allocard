/**
 * Rule runs are tenant-owned and append-only — a run is the audit trail of one
 * evaluation and is never rewritten. `cardIds` / `projectId` are storage-only
 * filter columns and do not appear on the domain object.
 */
import { isValidObjectId } from 'mongoose'
import { RuleRunModel } from '@/server/models/RuleRun'
import { toDomain } from '@/server/models/base'
import type { OrgContext } from '@/server/http/types'
import type { ActorType } from '@/shared/enums/audit'
import type { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type {
  ActionResult,
  DesiredState,
  MergeConflict,
  RuleRun,
  RuleRunDiff,
  RuleRunInputValue,
  RuleRunList,
} from '@/shared/types/ruleRun'

export type CreateRuleRunFields = {
  ruleId: string
  triggeredBy: string
  triggeredByType: ActorType
  triggerEvent: string
  inputs: RuleRunInputValue[]
  matched: boolean
  desiredState: DesiredState
  diff: RuleRunDiff
  actions: ActionResult[]
  conflicts: MergeConflict[]
  status: RuleRunStatus
  skipReason?: string | null
  failureReason?: string | null
  durationMs: number
  startedAt: string | Date
  finishedAt: string | Date
  projectId?: string | null
}

export type ListRuleRunsFilter = {
  ruleId?: string
  cardId?: string
  projectId?: string
  status?: RuleRunStatus
  page?: number
  pageSize?: number
}

function toRuleRun(doc: Parameters<typeof toDomain>[0]): RuleRun {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    orgId: String(raw.orgId),
    ruleId: String(raw.ruleId),
    triggeredBy: String(raw.triggeredBy),
    triggeredByType: raw.triggeredByType as RuleRun['triggeredByType'],
    triggerEvent: String(raw.triggerEvent),
    inputs: (raw.inputs ?? []) as RuleRunInputValue[],
    matched: Boolean(raw.matched),
    desiredState: raw.desiredState as DesiredState,
    diff: raw.diff as RuleRunDiff,
    actions: (raw.actions ?? []) as ActionResult[],
    conflicts: (raw.conflicts ?? []) as MergeConflict[],
    status: raw.status as RuleRun['status'],
    skipReason: raw.skipReason == null ? null : String(raw.skipReason),
    failureReason: raw.failureReason == null ? null : String(raw.failureReason),
    durationMs: Number(raw.durationMs),
    startedAt: String(raw.startedAt),
    finishedAt: String(raw.finishedAt),
  }
}

/** Card ids touched by a run — derived so history can filter by card. */
function cardIdsFrom(desiredState: DesiredState, diff: RuleRunDiff): string[] {
  const ids = new Set<string>()
  for (const card of desiredState.cards) {
    ids.add(card.cardId)
  }
  for (const card of diff.cards) {
    ids.add(card.cardId)
  }
  return [...ids]
}

export async function createRuleRun(ctx: OrgContext, input: CreateRuleRunFields): Promise<RuleRun> {
  const doc = await RuleRunModel.create({
    orgId: ctx.orgId,
    ruleId: input.ruleId,
    triggeredBy: input.triggeredBy,
    triggeredByType: input.triggeredByType,
    triggerEvent: input.triggerEvent,
    inputs: input.inputs.map((entry) => ({
      key: entry.key,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId,
      value: entry.value,
      observedAt: new Date(entry.observedAt),
      ttlSec: entry.ttlSec,
      stale: entry.stale,
    })),
    matched: input.matched,
    desiredState: input.desiredState,
    diff: input.diff,
    actions: input.actions,
    conflicts: input.conflicts,
    status: input.status,
    skipReason: input.skipReason ?? null,
    failureReason: input.failureReason ?? null,
    durationMs: input.durationMs,
    startedAt: new Date(input.startedAt),
    finishedAt: new Date(input.finishedAt),
    cardIds: cardIdsFrom(input.desiredState, input.diff),
    projectId: input.projectId ?? null,
  })
  return toRuleRun(doc)
}

export async function findRuleRunById(ctx: OrgContext, id: string): Promise<RuleRun | null> {
  if (!isValidObjectId(id)) {
    return null
  }
  const doc = await RuleRunModel.findOne({ _id: id, orgId: ctx.orgId }).lean().exec()
  return doc ? toRuleRun(doc) : null
}

export async function listRuleRuns(
  ctx: OrgContext,
  filter: ListRuleRunsFilter = {},
): Promise<RuleRunList> {
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20

  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.ruleId !== undefined) query.ruleId = filter.ruleId
  if (filter.cardId !== undefined) query.cardIds = filter.cardId
  if (filter.projectId !== undefined) query.projectId = filter.projectId
  if (filter.status !== undefined) query.status = filter.status

  const [total, docs] = await Promise.all([
    RuleRunModel.countDocuments(query).exec(),
    RuleRunModel.find(query)
      .sort({ startedAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean()
      .exec(),
  ])

  return {
    items: docs.map((doc) => toRuleRun(doc)),
    page,
    pageSize,
    total,
  }
}

export type ListRuleRunsForFeedFilter = {
  projectId?: string
  projectIds?: string[]
  from?: Date
  to?: Date
  limit?: number
}

export type RuleRunFeedRow = {
  run: RuleRun
  projectId: string | null
}

/** Unpaginated newest-first slice for activity feed merge (B9.1). */
export async function listRuleRunsForFeed(
  ctx: OrgContext,
  filter: ListRuleRunsForFeedFilter = {},
): Promise<RuleRunFeedRow[]> {
  const limit = filter.limit ?? 200
  const query: Record<string, unknown> = { orgId: ctx.orgId }
  if (filter.projectId !== undefined) query.projectId = filter.projectId
  if (filter.projectIds !== undefined) query.projectId = { $in: filter.projectIds }
  if (filter.from !== undefined || filter.to !== undefined) {
    const startedAt: Record<string, Date> = {}
    if (filter.from !== undefined) startedAt.$gte = filter.from
    if (filter.to !== undefined) startedAt.$lte = filter.to
    query.startedAt = startedAt
  }
  const docs = await RuleRunModel.find(query)
    .sort({ startedAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec()
  return docs.map((doc) => {
    const raw = doc as Record<string, unknown>
    return {
      run: toRuleRun(doc),
      projectId: raw.projectId == null ? null : String(raw.projectId),
    }
  })
}

/**
 * Most recent run for a rule — the previous-value source for `crossedAbove` /
 * `crossedBelow`. Optionally narrowed to one subject's runs.
 */
export async function findLastRuleRun(
  ctx: OrgContext,
  ruleId: string,
  options: { projectId?: string | null } = {},
): Promise<RuleRun | null> {
  const query: Record<string, unknown> = { orgId: ctx.orgId, ruleId }
  if (options.projectId !== undefined && options.projectId !== null) {
    query.projectId = options.projectId
  }
  const doc = await RuleRunModel.findOne(query).sort({ startedAt: -1, _id: -1 }).lean().exec()
  return doc ? toRuleRun(doc) : null
}

/** Latest run per card — powers `/api/cards/:id/explain`. */
export async function findLatestRunForCard(
  ctx: OrgContext,
  cardId: string,
): Promise<RuleRun | null> {
  const doc = await RuleRunModel.findOne({ orgId: ctx.orgId, cardIds: cardId })
    .sort({ startedAt: -1, _id: -1 })
    .lean()
    .exec()
  return doc ? toRuleRun(doc) : null
}

export type FlagReviewActionCandidate = {
  orgId: string
  projectId: string | null
  /** Member userId or card id — see targetKind. */
  targetId: string
  targetKind: 'member' | 'card'
  reason: string
  runId: string
}

/**
 * Cross-tenant sweep: matched rule runs with WOULD_APPLY `flag.review` actions.
 * allowCrossTenant — worker job only; keep greppable.
 */
export async function listFlagReviewActionCandidates(): Promise<FlagReviewActionCandidate[]> {
  const docs = await RuleRunModel.find({
    matched: true,
    actions: {
      $elemMatch: {
        action: 'flag.review',
        status: 'WOULD_APPLY',
        targetId: { $ne: null },
      },
    },
  })
    .setOptions({ allowCrossTenant: true })
    .sort({ startedAt: 1, _id: 1 })
    .lean()
    .exec()

  const out: FlagReviewActionCandidate[] = []
  for (const doc of docs) {
    const raw = doc as Record<string, unknown>
    const orgId = String(raw.orgId)
    const projectId = raw.projectId == null ? null : String(raw.projectId)
    const runId = String(raw._id)
    const actions = (raw.actions ?? []) as ActionResult[]
    for (const action of actions) {
      if (action.action !== 'flag.review') continue
      if (action.status !== 'WOULD_APPLY') continue
      if (action.targetId == null) continue
      const details = action.details ?? {}
      const targetKind = details.targetKind === 'card' ? 'card' : 'member'
      const reason =
        typeof details.reason === 'string' && details.reason.length > 0
          ? details.reason
          : 'Flagged by rule for review'
      out.push({
        orgId,
        projectId,
        targetId: action.targetId,
        targetKind,
        reason,
        runId,
      })
    }
  }
  return out
}
