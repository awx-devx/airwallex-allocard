import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ActorType } from '@/shared/enums/audit'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { OrgRole } from '@/shared/enums/orgRole'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import type { OrgContext } from '@/server/http/types'
import * as rules from '@/server/repositories/rules'
import * as ruleRuns from '@/server/repositories/ruleRuns'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function ruleInput(overrides: Partial<rules.CreateRuleFields> = {}): rules.CreateRuleFields {
  return {
    scope: { level: RuleScopeLevel.PROJECT, projectId: 'proj_1' },
    name: 'Member limits track remaining budget',
    trigger: { events: ['budget.updated'], debounceSec: 30 },
    when: {
      attr: 'project.budget.remaining',
      op: ConditionOperator.GT,
      value: 0,
    },
    then: [
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.PROJECT_CARDS },
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

function runInput(
  overrides: Partial<ruleRuns.CreateRuleRunFields> = {},
): ruleRuns.CreateRuleRunFields {
  return {
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
        observedAt: '2026-08-11T00:00:00.000Z',
        ttlSec: null,
        stale: false,
      },
    ],
    matched: true,
    desiredState: { cards: [{ cardId: 'card_1' }] },
    diff: { cards: [] },
    actions: [],
    conflicts: [],
    status: RuleRunStatus.SUCCESS,
    durationMs: 12,
    startedAt: '2026-08-11T00:00:00.000Z',
    finishedAt: '2026-08-11T00:00:00.012Z',
    projectId: 'proj_1',
    ...overrides,
  }
}

describe('repositories/rules', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([RuleModel.syncIndexes(), RuleRunModel.syncIndexes()])
  })

  describe('rules', () => {
    it('creates disabled at version 1 and finds by id; cross-org returns null', async () => {
      const orgCtx = ctx('org_1')
      const created = await rules.createRule(orgCtx, ruleInput())

      expect(created.enabled).toBe(false)
      expect(created.version).toBe(1)
      expect(created.priority).toBe(100)

      expect(await rules.findRuleById(orgCtx, created.id)).toEqual(created)
      expect(await rules.findRuleById(ctx('org_other'), created.id)).toBeNull()
      expect(await rules.findRuleById(orgCtx, 'not-an-object-id')).toBeNull()
    })

    it('bumps version on content patch but not on enable/disable', async () => {
      const orgCtx = ctx('org_1')
      const created = await rules.createRule(orgCtx, ruleInput())

      const patched = await rules.updateRule(orgCtx, created.id, { name: 'Renamed' })
      expect(patched?.name).toBe('Renamed')
      expect(patched?.version).toBe(2)

      const enabled = await rules.setRuleEnabled(orgCtx, created.id, true)
      expect(enabled?.enabled).toBe(true)
      expect(enabled?.version).toBe(2)
    })

    it('clears else[] when patched to null', async () => {
      const orgCtx = ctx('org_1')
      const created = await rules.createRule(
        orgCtx,
        ruleInput({
          else: [
            {
              action: RuleActionType.CARD_FREEZE,
              target: { select: RuleTargetSelect.PROJECT_CARDS },
              params: { reason: 'Budget exhausted' },
            },
          ],
        }),
      )
      expect(created.else).toHaveLength(1)

      const cleared = await rules.updateRule(orgCtx, created.id, { else: null })
      expect(cleared?.else).toBeUndefined()
    })

    it('selects enabled rules for a subject: org-wide always, project only its own', async () => {
      const orgCtx = ctx('org_1')
      const orgRule = await rules.createRule(
        orgCtx,
        ruleInput({ scope: { level: RuleScopeLevel.ORG }, name: 'Org wide', priority: 10 }),
      )
      const projectRule = await rules.createRule(orgCtx, ruleInput())
      const otherProjectRule = await rules.createRule(
        orgCtx,
        ruleInput({
          scope: { level: RuleScopeLevel.PROJECT, projectId: 'proj_2' },
          name: 'Other project',
        }),
      )
      await rules.setRuleEnabled(orgCtx, orgRule.id, true)
      await rules.setRuleEnabled(orgCtx, projectRule.id, true)
      await rules.setRuleEnabled(orgCtx, otherProjectRule.id, true)

      const selected = await rules.listEnabledRulesForScope(orgCtx, 'proj_1')
      expect(selected.map((rule) => rule.name)).toEqual([
        'Org wide',
        'Member limits track remaining budget',
      ])

      const orgOnly = await rules.listEnabledRulesForScope(orgCtx, null)
      expect(orgOnly.map((rule) => rule.name)).toEqual(['Org wide'])
    })

    it('excludes disabled rules from scope selection', async () => {
      const orgCtx = ctx('org_1')
      await rules.createRule(orgCtx, ruleInput())

      expect(await rules.listEnabledRulesForScope(orgCtx, 'proj_1')).toEqual([])
    })

    it('lists with project and enabled filters, and deletes scoped to the org', async () => {
      const orgCtx = ctx('org_1')
      const created = await rules.createRule(orgCtx, ruleInput())
      await rules.createRule(ctx('org_2'), ruleInput())

      const listed = await rules.listRules(orgCtx, { projectId: 'proj_1' })
      expect(listed.total).toBe(1)
      expect(await rules.listRules(orgCtx, { enabled: true })).toMatchObject({ total: 0 })

      expect(await rules.deleteRule(ctx('org_other'), created.id)).toBe(false)
      expect(await rules.deleteRule(orgCtx, created.id)).toBe(true)
      expect(await rules.findRuleById(orgCtx, created.id)).toBeNull()
    })
  })

  describe('ruleRuns', () => {
    it('records a run and hides storage-only filter columns', async () => {
      const orgCtx = ctx('org_1')
      const run = await ruleRuns.createRuleRun(orgCtx, runInput())

      expect(run.status).toBe(RuleRunStatus.SUCCESS)
      expect(run.inputs[0]?.observedAt).toBe('2026-08-11T00:00:00.000Z')
      expect(run).not.toHaveProperty('cardIds')
      expect(run).not.toHaveProperty('projectId')

      expect(await ruleRuns.findRuleRunById(orgCtx, run.id)).toEqual(run)
      expect(await ruleRuns.findRuleRunById(ctx('org_other'), run.id)).toBeNull()
    })

    it('filters history by rule, card, project, and status', async () => {
      const orgCtx = ctx('org_1')
      await ruleRuns.createRuleRun(orgCtx, runInput())
      await ruleRuns.createRuleRun(
        orgCtx,
        runInput({
          ruleId: 'rule_2',
          status: RuleRunStatus.PARTIAL,
          desiredState: { cards: [{ cardId: 'card_2' }] },
          projectId: 'proj_2',
          startedAt: '2026-08-11T02:00:00.000Z',
          finishedAt: '2026-08-11T02:00:00.020Z',
        }),
      )

      expect((await ruleRuns.listRuleRuns(orgCtx, { ruleId: 'rule_1' })).total).toBe(1)
      expect((await ruleRuns.listRuleRuns(orgCtx, { cardId: 'card_2' })).total).toBe(1)
      expect((await ruleRuns.listRuleRuns(orgCtx, { projectId: 'proj_1' })).total).toBe(1)
      expect((await ruleRuns.listRuleRuns(orgCtx, { status: RuleRunStatus.PARTIAL })).total).toBe(1)

      const all = await ruleRuns.listRuleRuns(orgCtx)
      expect(all.total).toBe(2)
      expect(all.items[0]?.ruleId).toBe('rule_2')
    })

    it('returns the most recent run per rule and per card', async () => {
      const orgCtx = ctx('org_1')
      await ruleRuns.createRuleRun(orgCtx, runInput())
      const latest = await ruleRuns.createRuleRun(
        orgCtx,
        runInput({
          startedAt: '2026-08-11T05:00:00.000Z',
          finishedAt: '2026-08-11T05:00:00.030Z',
        }),
      )

      expect((await ruleRuns.findLastRuleRun(orgCtx, 'rule_1'))?.id).toBe(latest.id)
      expect((await ruleRuns.findLatestRunForCard(orgCtx, 'card_1'))?.id).toBe(latest.id)
      expect(await ruleRuns.findLastRuleRun(ctx('org_other'), 'rule_1')).toBeNull()
      expect(await ruleRuns.findLatestRunForCard(orgCtx, 'card_missing')).toBeNull()
    })
  })
})
