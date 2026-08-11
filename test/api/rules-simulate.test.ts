import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as simulate } from '@/app/api/rules/simulate/route'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { UserModel } from '@/server/models/User'
import { CardModel } from '@/server/models/Card'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard, findCardById } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createProject, updateStatus } from '@/server/repositories/projects'
import { createRole } from '@/server/repositories/roles'
import { createRule, setRuleEnabled } from '@/server/repositories/rules'
import * as users from '@/server/repositories/users'
import { ruleContracts } from '@/shared/contracts/rule'
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
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

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

describe('/api/rules/simulate', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
      CardModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedWorld() {
    const user = await users.createUser({
      email: `u-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Sim User',
    })
    const org = await organizations.createOrganization({
      name: 'Sim Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    const session = {
      userId: user.id,
      orgId: org.id,
      orgRole: OrgRole.OWNER,
      onboarded: true as const,
    }

    const project = await createProject(ctx, { name: 'APAC', code: 'APAC' })
    await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date('2026-07-25T00:00:00.000Z'),
    })
    const role = await createRole(ctx, {
      key: 'spender',
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
      addedBy: user.id,
    })
    await upsertBudgetFields(ctx, project.id, { currency: 'USD', approvedAmount: 1_000_000 })
    await appendEntry(ctx, {
      projectId: project.id,
      type: BudgetEntryType.APPROVAL,
      amount: 1_000_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'seed',
      createdBy: user.id,
    })
    const cardholder = await createCardholder(ctx, {
      userId: 'user_member',
      airwallexCardholderId: 'aw_ch',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card',
      maskedNumber: '************1111',
      nickName: 'APAC',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: '10% of remaining',
      trigger: { events: ['budget.updated'] },
      when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
      then: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.PROJECT_CARDS },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [
                {
                  interval: TransactionLimitInterval.MONTHLY,
                  amount: 'project.budget.remaining * 0.10',
                },
              ],
            },
          },
        },
      ],
      createdBy: user.id,
    })
    await setRuleEnabled(ctx, rule.id, true)

    return { ctx, session, project, card, rule }
  }

  it('returns a dry-run diff without writing cards, runs, or redis', async () => {
    const { session, project, card } = await seedWorld()

    const res = await simulate(
      buildRequest({
        method: 'POST',
        path: '/api/rules/simulate',
        session,
        body: { projectId: project.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, ruleContracts.simulate.output)
    expect(body.runs[0]?.status).toBe(RuleRunStatus.DRY_RUN)
    expect(body.cardDiffs[0]?.changed).toBe(true)
    expect(body.cardDiffs[0]?.after.controls?.transactionLimits?.limits[0]?.amount).toBe(100_000)

    expect(
      (
        await findCardById(
          { orgId: session.orgId!, userId: session.userId, orgRole: OrgRole.OWNER },
          card.id,
        )
      )?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(400_000)
    expect(await RuleRunModel.countDocuments({ orgId: session.orgId }).exec()).toBe(0)
    expect(await getRedis().get(redisKeys.policyCard(card.id))).toBeNull()
  })
})
