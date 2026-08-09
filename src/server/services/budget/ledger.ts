/**
 * Single mutation authority for budget ledger writes.
 * All entry appends (HTTP adjustments, PUT approvals, B7/B8 system writes)
 * go through `appendBudgetEntry` so snapshot + Redis stay in sync.
 *
 * Audit is intentionally NOT written here — HTTP-facing services audit after
 * the ledger returns (one audit per user-facing mutation).
 */
import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys } from '@/server/redis'
import {
  appendEntry,
  findEntriesByProject,
  type AppendBudgetEntryInput,
} from '@/server/repositories/budgetEntries'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { updateProjectBudgetSnapshot } from '@/server/repositories/projects'
import {
  projectBudget,
  type BudgetProjectionValues,
} from '@/server/services/budget/projectProjection'
import { DEFAULT_BUDGET_THRESHOLD_PCTS } from '@/shared/schemas/budget'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import type { BudgetEntry, BudgetSnapshot } from '@/shared/types/budget'

const LOCK_TTL_MS = 5_000
const LOCK_RETRY_MS = 15
const LOCK_MAX_WAIT_MS = 2_000

export type LedgerEntryInput = Omit<AppendBudgetEntryInput, 'projectId'>

export type AppendBudgetEntryResult = {
  entry: BudgetEntry
  projection: BudgetSnapshot
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function withBudgetLock<T>(projectId: string, fn: () => Promise<T>): Promise<T> {
  const redis = getRedis()
  const key = redisKeys.lockBudget(projectId)
  const token = randomUUID()
  const deadline = Date.now() + LOCK_MAX_WAIT_MS

  while (Date.now() < deadline) {
    const acquired = await redis.set(key, token, { nx: true, px: LOCK_TTL_MS })
    if (acquired) {
      try {
        return await fn()
      } finally {
        const current = await redis.get(key)
        if (current === token) {
          await redis.del(key)
        }
      }
    }
    await sleep(LOCK_RETRY_MS)
  }

  throw AppError.conflict('Budget is locked; try again')
}

/** Thresholds crossed upward between previous and next utilisationPct. */
export function crossedThresholdsUpward(
  previousPct: number,
  nextPct: number,
  thresholds: readonly number[],
): number[] {
  return thresholds
    .filter((threshold) => previousPct < threshold && nextPct >= threshold)
    .sort((a, b) => a - b)
}

function toWireSnapshot(values: BudgetProjectionValues, updatedAt: Date): BudgetSnapshot {
  return {
    ...values,
    updatedAt: updatedAt.toISOString(),
  }
}

/**
 * Append one ledger entry, recompute projection, persist Project.budgetSnapshot
 * and Redis `budget:project:{id}` in the same unit of work, emit events.
 */
export async function appendBudgetEntry(
  ctx: OrgContext,
  projectId: string,
  input: LedgerEntryInput,
): Promise<AppendBudgetEntryResult> {
  await connectDb()

  return withBudgetLock(projectId, async () => {
    const budget = await findBudgetByProject(ctx, projectId)
    const thresholdPcts = budget?.thresholdPcts ?? [...DEFAULT_BUDGET_THRESHOLD_PCTS]

    const previousEntries = await findEntriesByProject(ctx, projectId)
    const previousProjection = projectBudget(previousEntries)
    // Prefer stored snapshot utilisation when present (matches hot-path cache).
    const previousUtilisationPct = previousProjection.utilisationPct

    const entry = await appendEntry(ctx, { ...input, projectId })

    const entries = await findEntriesByProject(ctx, projectId)
    const values = projectBudget(entries)
    const updatedAt = new Date()
    const projection = toWireSnapshot(values, updatedAt)

    await updateProjectBudgetSnapshot(ctx, projectId, {
      ...values,
      updatedAt,
    })

    const redis = getRedis()
    const redisKey = redisKeys.budgetProject(projectId)
    const redisOk = await redis.set(redisKey, JSON.stringify(projection))
    if (!redisOk) {
      throw new Error(`Failed to write Redis budget cache at ${redisKey}`)
    }

    const crossed = crossedThresholdsUpward(
      previousUtilisationPct,
      projection.utilisationPct,
      thresholdPcts,
    )
    for (const thresholdPct of crossed) {
      await publishEvent({
        type: DomainEventType.BUDGET_THRESHOLD_CROSSED,
        orgId: ctx.orgId,
        projectId,
        subjectType: 'budget',
        subjectId: projectId,
        payload: {
          projectId,
          thresholdPct,
          previousUtilisationPct,
          utilisationPct: projection.utilisationPct,
        },
      })
    }

    await publishEvent({
      type: DomainEventType.BUDGET_UPDATED,
      orgId: ctx.orgId,
      projectId,
      subjectType: 'budget',
      subjectId: projectId,
      payload: {
        projectId,
        entryId: entry.id,
        entryType: entry.type,
        approved: projection.approved,
        committed: projection.committed,
        actual: projection.actual,
        remaining: projection.remaining,
        utilisationPct: projection.utilisationPct,
        overCommitted: projection.overCommitted,
      },
    })

    if (entry.type === BudgetEntryType.APPROVAL) {
      await publishEvent({
        type: DomainEventType.BUDGET_APPROVED,
        orgId: ctx.orgId,
        projectId,
        subjectType: 'budget',
        subjectId: projectId,
        payload: {
          projectId,
          entryId: entry.id,
          approved: projection.approved,
        },
      })
    }

    return { entry, projection }
  })
}
