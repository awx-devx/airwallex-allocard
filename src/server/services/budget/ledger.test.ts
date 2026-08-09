import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { ProjectModel } from '@/server/models/Project'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import * as budgetEntries from '@/server/repositories/budgetEntries'
import * as budgets from '@/server/repositories/budgets'
import * as projects from '@/server/repositories/projects'
import { appendBudgetEntry, crossedThresholdsUpward } from '@/server/services/budget/ledger'
import { projectBudget } from '@/server/services/budget/projectProjection'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

async function seedProjectBudget(
  orgCtx: OrgContext,
  code: string,
  approvedAmount: number,
  thresholdPcts: number[] = [80, 90, 100],
) {
  const project = await projects.createProject(orgCtx, { name: code, code })
  await budgets.upsertBudgetFields(orgCtx, project.id, {
    currency: 'USD',
    approvedAmount,
    thresholdPcts,
  })
  return project
}

describe('budget/ledger', () => {
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
    resetEventPublisher()
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
  })

  it('crossedThresholdsUpward is edge-triggered only', () => {
    expect(crossedThresholdsUpward(70, 85, [80, 90, 100])).toEqual([80])
    expect(crossedThresholdsUpward(85, 95, [80, 90, 100])).toEqual([90])
    // already above 80 — staying above does not re-fire
    expect(crossedThresholdsUpward(85, 88, [80, 90, 100])).toEqual([])
    expect(crossedThresholdsUpward(95, 100, [80, 90, 100])).toEqual([100])
    expect(crossedThresholdsUpward(50, 100, [80, 90, 100])).toEqual([80, 90, 100])
  })

  it('snapshot equals recompute and Redis key is budget:project:{id}', async () => {
    const orgCtx = ctx('org_ledger')
    const project = await seedProjectBudget(orgCtx, 'LEDGER-1', 100_000)

    const { entry, projection } = await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 100_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_1',
      createdBy: orgCtx.userId,
    })

    expect(entry.type).toBe(BudgetEntryType.APPROVAL)

    const entries = await budgetEntries.findEntriesByProject(orgCtx, project.id)
    const recomputed = projectBudget(entries)
    expect(projection).toMatchObject(recomputed)

    const stored = await projects.findProjectById(orgCtx, project.id)
    expect(stored?.budgetSnapshot).toEqual(projection)

    const redisKey = redisKeys.budgetProject(project.id)
    expect(redisKey).toBe(`budget:project:${project.id}`)
    const cached = await getRedis().get(redisKey)
    expect(cached).not.toBeNull()
    expect(JSON.parse(cached!)).toEqual(projection)

    const events = getPublishedEvents()
    expect(events.some((e) => e.type === DomainEventType.BUDGET_UPDATED)).toBe(true)
    expect(events.some((e) => e.type === DomainEventType.BUDGET_APPROVED)).toBe(true)
  })

  it('emits threshold_crossed only on upward edge crosses', async () => {
    const orgCtx = ctx('org_thresh')
    const project = await seedProjectBudget(orgCtx, 'THRESH-1', 100_000, [80, 90, 100])

    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 100_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'b1',
      createdBy: orgCtx.userId,
    })
    resetEventPublisher()

    // utilisation = 70 — no cross of 80
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 70_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'c1',
      createdBy: orgCtx.userId,
    })
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.BUDGET_THRESHOLD_CROSSED),
    ).toHaveLength(0)
    resetEventPublisher()

    // 70 → 85 crosses 80 only
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 15_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'c2',
      createdBy: orgCtx.userId,
    })
    const crossed = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.BUDGET_THRESHOLD_CROSSED,
    )
    expect(crossed).toHaveLength(1)
    expect(crossed[0]?.payload).toMatchObject({
      thresholdPct: 80,
      previousUtilisationPct: 70,
      utilisationPct: 85,
    })
    resetEventPublisher()

    // 85 → 88 still above 80 — no new cross
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 3_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'c3',
      createdBy: orgCtx.userId,
    })
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.BUDGET_THRESHOLD_CROSSED),
    ).toHaveLength(0)
  })

  it('concurrent appends produce a final projection matching full recompute', async () => {
    const orgCtx = ctx('org_conc')
    const project = await seedProjectBudget(orgCtx, 'CONC-1', 1_000_000)

    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 1_000_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'b1',
      createdBy: orgCtx.userId,
    })

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        appendBudgetEntry(orgCtx, project.id, {
          type: BudgetEntryType.ADJUSTMENT,
          amount: 100,
          currency: 'USD',
          sourceType: BudgetEntrySourceType.MANUAL,
          sourceId: `adj_${i}`,
          createdBy: orgCtx.userId,
        }),
      ),
    )

    const entries = await budgetEntries.findEntriesByProject(orgCtx, project.id)
    expect(entries).toHaveLength(21)

    const recomputed = projectBudget(entries)
    const stored = await projects.findProjectById(orgCtx, project.id)
    expect(stored?.budgetSnapshot).toMatchObject(recomputed)

    const cached = JSON.parse((await getRedis().get(redisKeys.budgetProject(project.id)))!)
    expect(cached).toMatchObject(recomputed)
    expect(recomputed.approved).toBe(1_000_000 + 20 * 100)
  })
})
