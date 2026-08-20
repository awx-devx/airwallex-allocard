import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DomainEventType, type DomainEvent } from '@/server/events/types'
import {
  EVENTS_STREAM,
  WORKER_GROUP,
  createMemoryEventStream,
  resetEventStream,
  setEventStream,
} from '@/server/events/stream'
import * as dbConnect from '@/server/db/connect'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import * as organizationsRepo from '@/server/repositories/organizations'
import { createDebouncer } from '@/worker/debounce'
import { startWorker } from '@/worker/index'
import { createScheduler } from '@/worker/scheduler'
import { useTestDb } from './helpers/db'
import type { OrgContext } from '@/server/http/types'
import { CardModel } from '@/server/models/Card'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import { createOrganization } from '@/server/repositories/organizations'
import { createProject, updateStatus } from '@/server/repositories/projects'
import { createRule, setRuleEnabled } from '@/server/repositories/rules'
import { listRuleRuns } from '@/server/repositories/ruleRuns'
import { sweepScheduledRules } from '@/server/services/rules/sweep'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createRole } from '@/server/repositories/roles'

function event(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    type: DomainEventType.ATTRIBUTE_UPDATED,
    orgId: 'org_1',
    projectId: 'project_1',
    subjectType: 'attribute',
    subjectId: 'campaign.roas',
    payload: { key: 'campaign.roas' },
    emittedAt: new Date(),
    ...overrides,
  }
}

function controls(): CardControls {
  return {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [],
  }
}

describe('worker', () => {
  beforeEach(() => {
    resetRedis()
    resetEventStream()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('ROLE gate', () => {
    it('refuses to start when ROLE is not worker', async () => {
      await expect(startWorker({ role: undefined })).rejects.toThrow(/ROLE must be "worker"/)
      await expect(startWorker({ role: 'web' })).rejects.toThrow(/ROLE must be "worker"/)
    })

    it('starts when ROLE=worker', async () => {
      const runtime = await startWorker({
        role: 'worker',
        evaluate: async () => {},
        sweepRules: async () => {},
      })
      await runtime.stop()
    })
  })

  describe('debounce', () => {
    it('coalesces twenty events into one evaluation', async () => {
      vi.useFakeTimers()
      const runs: string[] = []
      const debouncer = createDebouncer({
        windowMs: 1000,
        schedule: (fn, ms) => {
          const handle = setTimeout(fn, ms)
          return { clear: () => clearTimeout(handle) }
        },
      })

      for (let i = 0; i < 20; i += 1) {
        await debouncer.schedule({
          ruleId: 'rule_1',
          subjectId: 'project_1',
          run: async () => {
            runs.push(`run-${i}`)
          },
        })
      }

      expect(debouncer.pendingCount()).toBe(1)
      expect(runs).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(1000)
      await debouncer.flush()

      expect(runs).toHaveLength(1)
      expect(runs[0]).toBe('run-19')
    })

    it('releases the rule lock after the evaluation', async () => {
      const debouncer = createDebouncer({ windowMs: 10 })
      await debouncer.schedule({
        ruleId: 'rule_1',
        subjectId: 'subject_1',
        run: async () => {},
      })
      expect(await getRedis().get(redisKeys.lockRule('rule_1', 'subject_1'))).toBe('1')
      await debouncer.flush()
      expect(await getRedis().get(redisKeys.lockRule('rule_1', 'subject_1'))).toBeNull()
    })
  })

  describe('scheduler locks', () => {
    it('skips a tick when another replica holds lock:job', async () => {
      await getRedis().set(redisKeys.lockJob('sweep-rules'), '1', { nx: true, px: 60_000 })
      const scheduler = createScheduler()
      let ran = 0
      const ranOnce = await scheduler.runOnce({
        name: 'sweep-rules',
        everyMs: 1000,
        run: async () => {
          ran += 1
        },
      })
      expect(ranOnce).toBe(false)
      expect(ran).toBe(0)
    })
  })

  describe('consumers + SIGTERM', () => {
    it('startWorker().stop drains in-flight work and releases the debounce lock', async () => {
      const stream = createMemoryEventStream()
      setEventStream(stream)

      let evaluateCalls = 0
      let resolveEval: (() => void) | undefined
      const evalGate = new Promise<void>((resolve) => {
        resolveEval = resolve
      })

      const lockRuleId = DomainEventType.ATTRIBUTE_UPDATED
      const lockSubjectId = 'org_1:project_1'

      const runtime = await startWorker({
        role: 'worker',
        stream,
        debounceWindowMs: 20,
        sweepRules: async () => {},
        evaluate: async () => {
          evaluateCalls += 1
          await evalGate
        },
      })

      await stream.publish(EVENTS_STREAM, event())

      // Wait until the trailing debounce fires and evaluate is in flight.
      const started = Date.now()
      while (evaluateCalls === 0 && Date.now() - started < 2000) {
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      expect(evaluateCalls).toBe(1)
      expect(await getRedis().get(redisKeys.lockRule(lockRuleId, lockSubjectId))).toBe('1')

      const stopPromise = runtime.stop()
      resolveEval?.()
      await stopPromise

      expect(await getRedis().get(redisKeys.lockRule(lockRuleId, lockSubjectId))).toBeNull()
    })

    it('acks stream entries after handling', async () => {
      const stream = createMemoryEventStream()
      const seen: DomainEvent[] = []
      await stream.ensureGroup(EVENTS_STREAM, WORKER_GROUP)
      await stream.publish(EVENTS_STREAM, event({ subjectId: 'a' }))
      await stream.publish(EVENTS_STREAM, event({ subjectId: 'b' }))

      const first = await stream.readGroup({
        stream: EVENTS_STREAM,
        group: WORKER_GROUP,
        consumer: 'c1',
        count: 10,
        blockMs: 10,
      })
      expect(first).toHaveLength(2)
      for (const entry of first) {
        seen.push(entry.event)
        await stream.ack(EVENTS_STREAM, WORKER_GROUP, [entry.id])
      }

      const second = await stream.readGroup({
        stream: EVENTS_STREAM,
        group: WORKER_GROUP,
        consumer: 'c1',
        count: 10,
        blockMs: 10,
      })
      expect(second).toHaveLength(0)
      expect(seen).toHaveLength(2)
    })
  })
})

describe('sweepScheduledRules', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      CardModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function seedOrgWithProject() {
    const org = await createOrganization({
      name: 'Sweep Org',
      slug: `org-${Math.random().toString(36).slice(2)}`,
      country: 'AU',
      baseCurrency: 'USD',
      createdBy: 'user_1',
    })
    const ctx: OrgContext = { orgId: org.id, userId: 'user_1', orgRole: OrgRole.OWNER }
    const project = await createProject(ctx, { name: 'Sweep', code: 'SWP-1' })
    await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date('2026-07-25T00:00:00.000Z'),
    })
    await upsertBudgetFields(ctx, project.id, { currency: 'USD', approvedAmount: 1_000_000 })
    await appendEntry(ctx, {
      projectId: project.id,
      type: BudgetEntryType.APPROVAL,
      amount: 1_000_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'seed',
      createdBy: 'user_1',
    })
    const role = await createRole(ctx, {
      key: 'project_spender',
      name: 'Spender',
      permissions: [],
      isTemplate: false,
    })
    await addProjectMember(ctx, {
      projectId: project.id,
      userId: 'user_member',
      roleId: role.id,
      scope: { level: AccessScopeLevel.OWN },
      effectivePermissions: [],
      addedBy: 'user_1',
    })
    const cardholder = await createCardholder(ctx, {
      userId: 'user_member',
      airwallexCardholderId: 'aw_ch_sweep',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card_sweep',
      maskedNumber: '************9999',
      nickName: 'Sweep',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    return { ctx, project }
  }

  it('connects to mongo before listing organisations', async () => {
    const order: string[] = []
    vi.spyOn(dbConnect, 'connectDb').mockImplementation(async () => {
      order.push('connect')
      return (await import('mongoose')).default
    })
    vi.spyOn(organizationsRepo, 'listAllOrganizations').mockImplementation(async () => {
      order.push('list')
      return []
    })

    const result = await sweepScheduledRules()
    expect(order).toEqual(['connect', 'list'])
    expect(result).toEqual({ orgsVisited: 0, evaluations: 0 })
  })

  it('evaluates scheduled rules and ignores event-only rules', async () => {
    const { ctx, project } = await seedOrgWithProject()

    const scheduled = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'Hourly util check',
      trigger: { schedule: '0 * * * *' },
      when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
      then: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.PROJECT_CARDS },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 77_000 }],
            },
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, scheduled.id, true)

    const eventOnly = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'On budget update',
      trigger: { events: ['budget.updated'] },
      when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
      then: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.PROJECT_CARDS },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 11_000 }],
            },
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, eventOnly.id, true)

    const update = vi.fn().mockResolvedValue({})
    const airwallex = {
      accountId: null,
      forAccount: () => airwallex,
      request: vi.fn(),
      cardholders: {} as never,
      cards: {
        create: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        listAllTenantsUnsafe: vi.fn(),
        update,
        limits: vi.fn(),
        activate: vi.fn(),
      },
      transactions: {} as never,
      config: {} as never,
      panTokens: {} as never,
    }

    const result = await sweepScheduledRules({ airwallex })
    expect(result.orgsVisited).toBeGreaterThanOrEqual(1)

    const runs = await listRuleRuns(ctx)
    expect(runs.items.some((run) => run.ruleId === scheduled.id)).toBe(true)
    expect(runs.items.some((run) => run.ruleId === eventOnly.id)).toBe(false)
    expect(runs.items.every((run) => run.triggerEvent === 'schedule')).toBe(true)
  })

  it('finds nothing to record when no scheduled rules exist', async () => {
    const { ctx, project } = await seedOrgWithProject()
    const eventOnly = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'Event only',
      trigger: { events: ['budget.updated'] },
      when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
      then: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.PROJECT_CARDS },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 11_000 }],
            },
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, eventOnly.id, true)

    await sweepScheduledRules({
      airwallex: {
        accountId: null,
        forAccount: () => ({}) as never,
        request: vi.fn(),
        cardholders: {} as never,
        cards: {
          create: vi.fn(),
          get: vi.fn(),
          list: vi.fn(),
          listAllTenantsUnsafe: vi.fn(),
          update: vi.fn(),
          limits: vi.fn(),
          activate: vi.fn(),
        },
        transactions: {} as never,
        config: {} as never,
        panTokens: {} as never,
      },
    })

    expect((await listRuleRuns(ctx)).total).toBe(0)
  })
})
