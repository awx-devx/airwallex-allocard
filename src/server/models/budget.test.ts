import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { BudgetChangeRequestStatus } from '@/shared/enums/budgetChangeRequestStatus'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetChangeRequestModel } from '@/server/models/BudgetChangeRequest'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { ProjectModel } from '@/server/models/Project'
import { toDomain } from '@/server/models/base'
import { DEFAULT_BUDGET_THRESHOLD_PCTS } from '@/shared/schemas/budget'
import type { Budget, BudgetChangeRequest, BudgetEntry } from '@/shared/types/budget'
import type { Project } from '@/shared/types/project'

async function syncIndexes(): Promise<void> {
  await Promise.all([
    BudgetModel.syncIndexes(),
    BudgetEntryModel.syncIndexes(),
    BudgetChangeRequestModel.syncIndexes(),
    ProjectModel.syncIndexes(),
  ])
}

function minimalBudget(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    currency: 'USD',
    approvedAmount: 1_000_00,
    ...overrides,
  }
}

function minimalEntry(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    type: BudgetEntryType.APPROVAL,
    amount: 1_000_00,
    currency: 'USD',
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: 'src_1',
    createdBy: 'user_1',
    ...overrides,
  }
}

function minimalChangeRequest(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    requestedBy: 'user_1',
    deltaAmount: 50_00,
    reason: 'Need more media spend',
    ...overrides,
  }
}

describe('models/budget', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  describe('Budget', () => {
    it('defaults empty categories and thresholdPcts [80, 90, 100]', async () => {
      const doc = await BudgetModel.create(minimalBudget())

      expect(doc.formula).toBeNull()
      expect(doc.categories).toEqual([])
      expect(doc.thresholdPcts).toEqual([...DEFAULT_BUDGET_THRESHOLD_PCTS])
      expect(doc.approvedAmount).toBe(1_000_00)
    })

    it('embeds categories with explicit id (no subdocument _id)', async () => {
      const doc = await BudgetModel.create(
        minimalBudget({
          categories: [
            {
              id: 'cat_1',
              name: 'Media',
              workstreamId: 'ws_1',
              allocated: 400_00,
              formula: null,
            },
          ],
        }),
      )

      expect(doc.categories).toHaveLength(1)
      expect(doc.categories[0]).toMatchObject({
        id: 'cat_1',
        name: 'Media',
        workstreamId: 'ws_1',
        allocated: 400_00,
      })

      const json = doc.toJSON() as Record<string, unknown>
      const categories = json.categories as Record<string, unknown>[]
      expect(categories[0]).not.toHaveProperty('_id')
      expect(categories[0]?.id).toBe('cat_1')
    })

    it('enforces unique (orgId, projectId)', async () => {
      await BudgetModel.create(minimalBudget())

      await expect(BudgetModel.create(minimalBudget({ approvedAmount: 2 }))).rejects.toMatchObject({
        code: 11000,
      })
    })

    it('allows the same projectId in a different org', async () => {
      await BudgetModel.create(minimalBudget({ orgId: 'org_1' }))
      const other = await BudgetModel.create(minimalBudget({ orgId: 'org_2' }))

      expect(other.orgId).toBe('org_2')
      expect(other.projectId).toBe('proj_1')
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(BudgetModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on Budget\.find/,
      )

      await BudgetModel.create(minimalBudget())
      const docs = await BudgetModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id and ISO dates via toJSON / toDomain', async () => {
      const doc = await BudgetModel.create(minimalBudget())

      const json = doc.toJSON() as Record<string, unknown>
      expect(json.id).toEqual(expect.any(String))
      expect(json).not.toHaveProperty('_id')
      expect(typeof json.createdAt).toBe('string')
      expect(typeof json.updatedAt).toBe('string')

      const domain = toDomain<Budget>(doc)
      expect(domain.id).toEqual(expect.any(String))
      expect(domain.currency).toBe('USD')
      expect(domain.approvedAmount).toBe(1_000_00)
    })

    it('stores approvedAmount as Number integer (not Decimal128)', async () => {
      const doc = await BudgetModel.create(minimalBudget({ approvedAmount: 402_350 }))
      expect(typeof doc.approvedAmount).toBe('number')
      expect(Number.isInteger(doc.approvedAmount)).toBe(true)
      expect(doc.approvedAmount).toBe(402_350)
    })
  })

  describe('BudgetEntry', () => {
    it('defaults categoryId, lifecycleId, and note to null', async () => {
      const doc = await BudgetEntryModel.create(minimalEntry())

      expect(doc.categoryId).toBeNull()
      expect(doc.lifecycleId).toBeNull()
      expect(doc.note).toBeNull()
      expect(doc.type).toBe(BudgetEntryType.APPROVAL)
    })

    it('allows signed amount for ADJUSTMENT', async () => {
      const doc = await BudgetEntryModel.create(
        minimalEntry({
          type: BudgetEntryType.ADJUSTMENT,
          amount: -25_00,
        }),
      )

      expect(doc.amount).toBe(-25_00)
      expect(Number.isInteger(doc.amount)).toBe(true)
    })

    it('persists lifecycleId when set (B8 seam)', async () => {
      const doc = await BudgetEntryModel.create(
        minimalEntry({
          type: BudgetEntryType.COMMITMENT,
          lifecycleId: 'life_1',
        }),
      )

      expect(doc.lifecycleId).toBe('life_1')
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(BudgetEntryModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on BudgetEntry\.find/,
      )

      await BudgetEntryModel.create(minimalEntry())
      const docs = await BudgetEntryModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id and ISO dates via toJSON / toDomain', async () => {
      const doc = await BudgetEntryModel.create(minimalEntry({ note: 'initial approval' }))

      const json = doc.toJSON() as Record<string, unknown>
      expect(json.id).toEqual(expect.any(String))
      expect(json).not.toHaveProperty('_id')
      expect(typeof json.createdAt).toBe('string')

      const domain = toDomain<BudgetEntry>(doc)
      expect(domain.note).toBe('initial approval')
      expect(domain.lifecycleId).toBeNull()
      expect(domain.sourceType).toBe(BudgetEntrySourceType.MANUAL)
    })
  })

  describe('BudgetChangeRequest', () => {
    it('defaults status PENDING and decided fields null', async () => {
      const doc = await BudgetChangeRequestModel.create(minimalChangeRequest())

      expect(doc.status).toBe(BudgetChangeRequestStatus.PENDING)
      expect(doc.decidedBy).toBeNull()
      expect(doc.decidedAt).toBeNull()
      expect(doc.deltaAmount).toBe(50_00)
    })

    it('allows negative deltaAmount', async () => {
      const doc = await BudgetChangeRequestModel.create(
        minimalChangeRequest({ deltaAmount: -10_00 }),
      )
      expect(doc.deltaAmount).toBe(-10_00)
      expect(Number.isInteger(doc.deltaAmount)).toBe(true)
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(BudgetChangeRequestModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on BudgetChangeRequest\.find/,
      )

      await BudgetChangeRequestModel.create(minimalChangeRequest())
      const docs = await BudgetChangeRequestModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id and ISO dates via toJSON / toDomain', async () => {
      const decidedAt = new Date('2026-08-01T12:00:00.000Z')
      const doc = await BudgetChangeRequestModel.create(
        minimalChangeRequest({
          status: BudgetChangeRequestStatus.APPROVED,
          decidedBy: 'user_2',
          decidedAt,
        }),
      )

      const json = doc.toJSON() as Record<string, unknown>
      expect(json.id).toEqual(expect.any(String))
      expect(json.decidedAt).toBe('2026-08-01T12:00:00.000Z')

      const domain = toDomain<BudgetChangeRequest>(doc)
      expect(domain.status).toBe(BudgetChangeRequestStatus.APPROVED)
      expect(domain.decidedBy).toBe('user_2')
      expect(domain.decidedAt).toBe('2026-08-01T12:00:00.000Z')
    })
  })

  describe('Project.budgetSnapshot', () => {
    it('defaults budgetSnapshot to null', async () => {
      const doc = await ProjectModel.create({
        orgId: 'org_1',
        name: 'APAC Launch',
        code: 'APAC-BUDGET',
      })

      expect(doc.budgetSnapshot).toBeNull()
    })

    it('stores snapshot with Date updatedAt and emits ISO via toDomain', async () => {
      const updatedAt = new Date('2026-08-09T00:00:00.000Z')
      const doc = await ProjectModel.create({
        orgId: 'org_1',
        name: 'APAC Launch',
        code: 'APAC-SNAP',
        budgetSnapshot: {
          approved: 1_000_00,
          committed: 200_00,
          actual: 50_00,
          remaining: 750_00,
          utilisationPct: 25,
          overCommitted: false,
          updatedAt,
        },
      })

      expect(doc.budgetSnapshot?.approved).toBe(1_000_00)
      expect(doc.budgetSnapshot?.updatedAt).toEqual(updatedAt)

      const json = doc.toJSON() as Record<string, unknown>
      const snapshot = json.budgetSnapshot as Record<string, unknown>
      expect(snapshot).not.toHaveProperty('_id')
      expect(snapshot.updatedAt).toBe('2026-08-09T00:00:00.000Z')

      const domain = toDomain<Project>(doc)
      expect(domain.budgetSnapshot).toMatchObject({
        approved: 1_000_00,
        remaining: 750_00,
        overCommitted: false,
        updatedAt: '2026-08-09T00:00:00.000Z',
      })
    })
  })
})
