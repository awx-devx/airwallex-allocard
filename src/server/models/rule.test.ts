import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ActorType } from '@/shared/enums/audit'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { toDomain } from '@/server/models/base'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import type { Rule } from '@/shared/types/rule'
import type { RuleRun } from '@/shared/types/ruleRun'

async function syncIndexes(): Promise<void> {
  await Promise.all([RuleModel.syncIndexes(), RuleRunModel.syncIndexes()])
}

function minimalRule(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    scope: { level: RuleScopeLevel.PROJECT, projectId: 'proj_1' },
    name: 'Member card limits track remaining project budget',
    trigger: { events: ['budget.updated'], debounceSec: 30 },
    when: {
      all: [
        { attr: 'project.status', op: 'eq', value: 'ACTIVE' },
        { attr: 'project.budget.remaining', op: 'gt', value: 0 },
      ],
    },
    then: [
      {
        action: 'card.setControls',
        target: { select: 'PROJECT_CARDS', filter: { purpose: 'MEMBER' } },
        params: {
          transactionLimits: {
            currency: 'USD',
            limits: [{ interval: 'MONTHLY', amount: 'project.budget.remaining * 0.10' }],
          },
        },
      },
    ],
    createdBy: 'user_1',
    ...overrides,
  }
}

function minimalRuleRun(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    ruleId: 'rule_1',
    triggeredBy: 'system',
    triggeredByType: ActorType.SYSTEM,
    triggerEvent: 'budget.updated',
    inputs: [
      {
        key: 'project.budget.remaining',
        subjectType: AttributeSubjectType.PROJECT,
        subjectId: 'proj_1',
        value: 400_000,
        observedAt: new Date('2026-08-11T00:00:00.000Z'),
        ttlSec: null,
        stale: false,
      },
    ],
    matched: true,
    desiredState: { cards: [{ cardId: 'card_1', cardStatus: 'ACTIVE' }] },
    diff: { cards: [] },
    actions: [],
    conflicts: [],
    status: RuleRunStatus.SUCCESS,
    durationMs: 12,
    startedAt: new Date('2026-08-11T00:00:00.000Z'),
    finishedAt: new Date('2026-08-11T00:00:00.012Z'),
    ...overrides,
  }
}

describe('models/rule', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  describe('Rule', () => {
    it('defaults enabled false, priority 100, version 1', async () => {
      const doc = await RuleModel.create(minimalRule())

      expect(doc.enabled).toBe(false)
      expect(doc.priority).toBe(100)
      expect(doc.version).toBe(1)
      expect(doc.description).toBeNull()
      expect(doc.else).toBeUndefined()
    })

    it('round-trips the nested DSL through Mixed without reshaping it', async () => {
      const doc = await RuleModel.create(minimalRule())
      const domain = toDomain<Rule>(doc)

      expect(domain.when).toEqual({
        all: [
          { attr: 'project.status', op: 'eq', value: 'ACTIVE' },
          { attr: 'project.budget.remaining', op: 'gt', value: 0 },
        ],
      })
      expect(domain.then[0]?.params.transactionLimits?.limits[0]?.amount).toBe(
        'project.budget.remaining * 0.10',
      )
      expect(domain.scope).toEqual({ level: RuleScopeLevel.PROJECT, projectId: 'proj_1' })
      expect(domain.trigger.events).toEqual(['budget.updated'])
    })

    it('omits projectId for ORG-scoped rules', async () => {
      const doc = await RuleModel.create(
        minimalRule({ scope: { level: RuleScopeLevel.ORG }, name: 'Org wide' }),
      )
      const domain = toDomain<Rule>(doc)

      expect(domain.scope.level).toBe(RuleScopeLevel.ORG)
      expect(domain.scope.projectId).toBeUndefined()
    })

    it('rejects unknown fields (strict throw)', async () => {
      await expect(RuleModel.create(minimalRule({ notAField: true }))).rejects.toThrow(/strict/i)
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(RuleModel.find({}).exec()).rejects.toThrow(/Tenant scope missing on Rule\.find/)

      await RuleModel.create(minimalRule())
      const docs = await RuleModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id and ISO dates via toDomain', async () => {
      const doc = await RuleModel.create(minimalRule())
      const domain = toDomain<Rule>(doc)

      expect(domain.id).toEqual(expect.any(String))
      expect(typeof domain.createdAt).toBe('string')
      expect(typeof domain.updatedAt).toBe('string')
    })
  })

  describe('RuleRun', () => {
    it('defaults reason fields to null and arrays to empty', async () => {
      const doc = await RuleRunModel.create(minimalRuleRun())

      expect(doc.skipReason).toBeNull()
      expect(doc.failureReason).toBeNull()
      expect(doc.actions).toEqual([])
      expect(doc.conflicts).toEqual([])
      expect(doc.cardIds).toEqual([])
      expect(doc.projectId).toBeNull()
    })

    it('records SKIPPED with the stale key named, never a zero value', async () => {
      const doc = await RuleRunModel.create(
        minimalRuleRun({
          matched: false,
          status: RuleRunStatus.SKIPPED,
          skipReason: 'stale input: campaign.roas',
          inputs: [
            {
              key: 'campaign.roas',
              subjectType: AttributeSubjectType.PROJECT,
              subjectId: 'proj_1',
              value: 2.4,
              observedAt: new Date('2026-08-10T00:00:00.000Z'),
              ttlSec: 900,
              stale: true,
            },
          ],
        }),
      )

      expect(doc.status).toBe(RuleRunStatus.SKIPPED)
      expect(doc.skipReason).toBe('stale input: campaign.roas')
      expect(doc.inputs[0]?.stale).toBe(true)
      expect(doc.inputs[0]?.value).toBe(2.4)
    })

    it('strips storage-only cardIds and projectId from the domain shape', async () => {
      const doc = await RuleRunModel.create(
        minimalRuleRun({ cardIds: ['card_1'], projectId: 'proj_1' }),
      )
      const domain = toDomain<RuleRun>(doc)

      expect(domain).not.toHaveProperty('cardIds')
      expect(domain).not.toHaveProperty('projectId')
      expect(domain.startedAt).toBe('2026-08-11T00:00:00.000Z')
      expect(domain.finishedAt).toBe('2026-08-11T00:00:00.012Z')
      expect(domain.inputs[0]?.observedAt).toBe('2026-08-11T00:00:00.000Z')
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(RuleRunModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on RuleRun\.find/,
      )
    })
  })
})
