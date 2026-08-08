import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetChangeRequestModel } from '@/server/models/BudgetChangeRequest'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { ProjectModel } from '@/server/models/Project'
import type { OrgContext } from '@/server/http/types'
import * as budgetChangeRequests from '@/server/repositories/budgetChangeRequests'
import * as budgetEntries from '@/server/repositories/budgetEntries'
import * as budgets from '@/server/repositories/budgets'
import * as projects from '@/server/repositories/projects'
import { DEFAULT_BUDGET_THRESHOLD_PCTS } from '@/shared/schemas/budget'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('repositories/budget', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      BudgetChangeRequestModel.syncIndexes(),
      ProjectModel.syncIndexes(),
    ])
  })

  describe('budgets', () => {
    it('upserts by project and finds within org only', async () => {
      const orgCtx = ctx('org_1')
      const created = await budgets.upsertBudgetFields(orgCtx, 'proj_1', {
        currency: 'USD',
        approvedAmount: 100_000,
      })

      expect(created.projectId).toBe('proj_1')
      expect(created.approvedAmount).toBe(100_000)
      expect(created.thresholdPcts).toEqual([...DEFAULT_BUDGET_THRESHOLD_PCTS])
      expect(created.categories).toEqual([])

      const found = await budgets.findBudgetByProject(orgCtx, 'proj_1')
      expect(found).toEqual(created)
      expect(await budgets.findBudgetByProject(ctx('org_other'), 'proj_1')).toBeNull()

      const updated = await budgets.upsertBudgetFields(orgCtx, 'proj_1', {
        currency: 'EUR',
        approvedAmount: 200_000,
        formula: 'approvedAmount',
        thresholdPcts: [50, 100],
      })
      expect(updated.id).toBe(created.id)
      expect(updated.currency).toBe('EUR')
      expect(updated.approvedAmount).toBe(200_000)
      expect(updated.formula).toBe('approvedAmount')
      expect(updated.thresholdPcts).toEqual([50, 100])
    })

    it('rejects duplicate (orgId, projectId)', async () => {
      await budgets.upsertBudgetFields(ctx('org_dup'), 'proj_dup', {
        currency: 'USD',
        approvedAmount: 1,
      })

      await expect(
        BudgetModel.create({
          orgId: 'org_dup',
          projectId: 'proj_dup',
          currency: 'USD',
          approvedAmount: 2,
        }),
      ).rejects.toMatchObject({ code: 11000 })
    })

    it('adds, updates, replaces, and deletes categories', async () => {
      const orgCtx = ctx('org_cat')
      await budgets.upsertBudgetFields(orgCtx, 'proj_cat', {
        currency: 'USD',
        approvedAmount: 50_000,
      })

      const media = await budgets.addCategory(orgCtx, 'proj_cat', {
        name: 'Media',
        allocated: 20_000,
        workstreamId: 'ws_1',
      })
      expect(media).toMatchObject({ name: 'Media', allocated: 20_000, workstreamId: 'ws_1' })

      const renamed = await budgets.updateCategory(orgCtx, 'proj_cat', media!.id, {
        name: 'Paid Media',
        allocated: 25_000,
      })
      expect(renamed).toMatchObject({ name: 'Paid Media', allocated: 25_000 })

      const replaced = await budgets.replaceCategories(orgCtx, 'proj_cat', [
        {
          id: 'cat_fixed',
          name: 'Fixed',
          workstreamId: null,
          allocated: 10_000,
          formula: null,
        },
      ])
      expect(replaced?.categories).toHaveLength(1)
      expect(replaced?.categories[0]?.id).toBe('cat_fixed')

      expect(await budgets.deleteCategory(orgCtx, 'proj_cat', 'cat_fixed')).toBe(true)
      expect(await budgets.deleteCategory(orgCtx, 'proj_cat', 'cat_fixed')).toBe(false)
      expect((await budgets.findBudgetByProject(orgCtx, 'proj_cat'))?.categories).toEqual([])
    })
  })

  describe('budgetEntries', () => {
    it('appends entries and never mutates amounts', async () => {
      const orgCtx = ctx('org_ent')
      const entry = await budgetEntries.appendEntry(orgCtx, {
        projectId: 'proj_ent',
        type: BudgetEntryType.APPROVAL,
        amount: 10_000,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: 'budget_1',
        createdBy: 'user_1',
      })

      expect(entry.amount).toBe(10_000)
      expect(entry.lifecycleId).toBeNull()

      const adjustment = await budgetEntries.appendEntry(orgCtx, {
        projectId: 'proj_ent',
        type: BudgetEntryType.ADJUSTMENT,
        amount: -500,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: 'manual_1',
        createdBy: 'user_1',
        note: 'correction',
      })
      expect(adjustment.amount).toBe(-500)

      const all = await budgetEntries.findEntriesByProject(orgCtx, 'proj_ent')
      expect(all).toHaveLength(2)
      expect(all[0]?.type).toBe(BudgetEntryType.APPROVAL)
      expect(all[1]?.type).toBe(BudgetEntryType.ADJUSTMENT)
    })

    it('lists with type filter and pagination; counts category refs', async () => {
      const orgCtx = ctx('org_list')
      for (const [type, amount] of [
        [BudgetEntryType.APPROVAL, 1000],
        [BudgetEntryType.COMMITMENT, 200],
        [BudgetEntryType.ACTUAL, 50],
      ] as const) {
        await budgetEntries.appendEntry(orgCtx, {
          projectId: 'proj_list',
          type,
          amount,
          currency: 'USD',
          sourceType: BudgetEntrySourceType.MANUAL,
          sourceId: `src_${type}`,
          createdBy: 'user_1',
          categoryId: type === BudgetEntryType.ACTUAL ? 'cat_1' : null,
        })
      }

      const page = await budgetEntries.listEntries(orgCtx, 'proj_list', {
        page: 1,
        pageSize: 2,
      })
      expect(page.items).toHaveLength(2)
      expect(page.total).toBe(3)

      const commitments = await budgetEntries.listEntries(orgCtx, 'proj_list', {
        type: BudgetEntryType.COMMITMENT,
      })
      expect(commitments.total).toBe(1)
      expect(commitments.items[0]?.amount).toBe(200)

      expect(
        await budgetEntries.countEntriesReferencingCategory(orgCtx, 'proj_list', 'cat_1'),
      ).toBe(1)
      expect(await budgetEntries.countEntriesReferencingCategory(orgCtx, 'proj_list', 'none')).toBe(
        0,
      )
      expect(
        await budgetEntries.countEntriesReferencingCategory(ctx('org_other'), 'proj_list', 'cat_1'),
      ).toBe(0)
    })
  })

  describe('budgetChangeRequests', () => {
    it('creates, lists, and decides PENDING only once', async () => {
      const orgCtx = ctx('org_cr', 'decider_1')
      const created = await budgetChangeRequests.createChangeRequest(orgCtx, {
        projectId: 'proj_cr',
        requestedBy: 'req_1',
        deltaAmount: 5_000,
        reason: 'Need more',
      })
      expect(created.status).toBe(BudgetChangeRequestStatus.PENDING)

      const listed = await budgetChangeRequests.listChangeRequests(orgCtx, 'proj_cr')
      expect(listed).toHaveLength(1)

      const approved = await budgetChangeRequests.decideChangeRequest(
        orgCtx,
        created.id,
        BudgetChangeRequestStatus.APPROVED,
      )
      expect(approved?.status).toBe(BudgetChangeRequestStatus.APPROVED)
      expect(approved?.decidedBy).toBe('decider_1')
      expect(approved?.decidedAt).toEqual(expect.any(String))

      const again = await budgetChangeRequests.decideChangeRequest(
        orgCtx,
        created.id,
        BudgetChangeRequestStatus.REJECTED,
      )
      expect(again).toBeNull()

      expect(
        await budgetChangeRequests.findChangeRequestById(ctx('org_other'), created.id),
      ).toBeNull()
    })
  })

  describe('updateProjectBudgetSnapshot', () => {
    it('writes snapshot onto the project within org', async () => {
      const orgCtx = ctx('org_snap')
      const project = await projects.createProject(orgCtx, {
        name: 'Snap',
        code: 'SNAP-1',
      })
      expect(project.budgetSnapshot).toBeNull()

      const updatedAt = new Date('2026-08-09T12:00:00.000Z')
      const updated = await projects.updateProjectBudgetSnapshot(orgCtx, project.id, {
        approved: 10_000,
        committed: 2_000,
        actual: 1_000,
        remaining: 7_000,
        utilisationPct: 30,
        overCommitted: false,
        updatedAt,
      })

      expect(updated?.budgetSnapshot).toEqual({
        approved: 10_000,
        committed: 2_000,
        actual: 1_000,
        remaining: 7_000,
        utilisationPct: 30,
        overCommitted: false,
        updatedAt: '2026-08-09T12:00:00.000Z',
      })

      expect(
        await projects.updateProjectBudgetSnapshot(ctx('org_other'), project.id, {
          approved: 1,
          committed: 0,
          actual: 0,
          remaining: 1,
          utilisationPct: 0,
          overCommitted: false,
          updatedAt,
        }),
      ).toBeNull()
    })
  })
})
