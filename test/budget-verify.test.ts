import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { verifyBudgets } from '../scripts/budget-verify'
import { useTestDb } from './helpers/db'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { BudgetModel } from '@/server/models/Budget'
import { ProjectModel } from '@/server/models/Project'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import * as budgets from '@/server/repositories/budgets'
import * as projects from '@/server/repositories/projects'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'

function ctx(orgId: string, userId = 'user_verify'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('budget:verify', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
  })

  afterEach(() => {
    resetRedis()
  })

  it('passes when Mongo snapshot and Redis match recompute', async () => {
    const orgCtx = ctx('org_verify_ok')
    const project = await projects.createProject(orgCtx, {
      name: 'Verify OK',
      code: 'VFY-OK',
    })
    await budgets.upsertBudgetFields(orgCtx, project.id, {
      currency: 'USD',
      approvedAmount: 50_000,
      thresholdPcts: [80, 100],
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 50_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_vfy',
      createdBy: orgCtx.userId,
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 10_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.PURCHASE_REQUEST,
      sourceId: 'pr_vfy',
      createdBy: orgCtx.userId,
    })

    const result = await verifyBudgets()
    expect(result.ok).toBe(true)
    expect(result.checked).toBeGreaterThanOrEqual(1)
    expect(result.drifts).toEqual([])
  })

  it('fails when Mongo snapshot drifts from ledger', async () => {
    const orgCtx = ctx('org_verify_mongo')
    const project = await projects.createProject(orgCtx, {
      name: 'Verify Mongo Drift',
      code: 'VFY-MONGO',
    })
    await budgets.upsertBudgetFields(orgCtx, project.id, {
      currency: 'USD',
      approvedAmount: 40_000,
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 40_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_m',
      createdBy: orgCtx.userId,
    })

    await projects.updateProjectBudgetSnapshot(orgCtx, project.id, {
      approved: 1,
      committed: 0,
      actual: 0,
      remaining: 1,
      utilisationPct: 0,
      overCommitted: false,
      updatedAt: new Date(),
    })

    const result = await verifyBudgets()
    expect(result.ok).toBe(false)
    expect(
      result.drifts.some((d) => d.projectId === project.id && d.reason.includes('Mongo')),
    ).toBe(true)
  })

  it('fails when Redis key is missing or drifted', async () => {
    const orgCtx = ctx('org_verify_redis')
    const project = await projects.createProject(orgCtx, {
      name: 'Verify Redis Drift',
      code: 'VFY-REDIS',
    })
    await budgets.upsertBudgetFields(orgCtx, project.id, {
      currency: 'USD',
      approvedAmount: 30_000,
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 30_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_r',
      createdBy: orgCtx.userId,
    })

    const redis = getRedis()
    await redis.del(redisKeys.budgetProject(project.id))

    const missing = await verifyBudgets()
    expect(missing.ok).toBe(false)
    expect(
      missing.drifts.some((d) => d.projectId === project.id && d.reason.includes('Missing Redis')),
    ).toBe(true)

    await redis.set(
      redisKeys.budgetProject(project.id),
      JSON.stringify({
        approved: 999,
        committed: 0,
        actual: 0,
        remaining: 999,
        utilisationPct: 0,
        overCommitted: false,
        updatedAt: new Date().toISOString(),
      }),
    )

    const drifted = await verifyBudgets()
    expect(drifted.ok).toBe(false)
    expect(
      drifted.drifts.some((d) => d.projectId === project.id && d.reason.includes('Redis drift')),
    ).toBe(true)
  })
})
