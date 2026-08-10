import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { makeCardControls } from '../../../../test/helpers/factories'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import type { OrgContext } from '@/server/http/types'
import { putAttributeValue } from '@/server/repositories/attributeValues'
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard } from '@/server/repositories/cards'
import { createOrganization } from '@/server/repositories/organizations'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createProject, updateStatus } from '@/server/repositories/projects'
import { createRole } from '@/server/repositories/roles'
import {
  buildAttributeContext,
  isStale,
  lookupAttribute,
  requireAttributes,
} from '@/server/services/attributes/resolve'
import type { CardControls } from '@/shared/types/cardControls'

const NOW = new Date('2026-08-11T00:00:00.000Z')

async function seedProject() {
  const org = await createOrganization({
    name: 'Test Org',
    slug: `org-${Date.now()}`,
    country: 'AU',
    baseCurrency: 'AUD',
    createdBy: 'user_1',
  })
  const ctx: OrgContext = { orgId: org.id, userId: 'user_1', orgRole: OrgRole.OWNER }

  const project = await createProject(ctx, {
    name: 'APAC Launch',
    code: 'APAC-1',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-08-31T00:00:00.000Z'),
  })
  await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
    approvedAt: new Date('2026-07-25T00:00:00.000Z'),
  })

  const role = await createRole(ctx, {
    key: 'project_spender',
    name: 'Project Spender',
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

  await upsertBudgetFields(ctx, project.id, { currency: 'AUD', approvedAmount: 1_000_000 })
  await appendEntry(ctx, {
    projectId: project.id,
    type: BudgetEntryType.APPROVAL,
    amount: 1_000_000,
    currency: 'AUD',
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: 'seed',
    createdBy: 'user_1',
  })
  await appendEntry(ctx, {
    projectId: project.id,
    type: BudgetEntryType.ACTUAL,
    amount: 400_000,
    currency: 'AUD',
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: 'seed',
    createdBy: 'user_1',
  })

  const card = await createCard(ctx, {
    projectId: project.id,
    cardholderId: 'ch_1',
    airwallexCardId: 'aw_card_1',
    maskedNumber: '************1234',
    nickName: 'APAC Launch',
    purpose: CardPurpose.MEMBER,
    status: CardStatus.ACTIVE,
    desiredControls: makeCardControls() as CardControls,
    appliedControls: makeCardControls() as CardControls,
  })

  return { ctx, project, card, role }
}

describe('attributes/resolve', () => {
  useTestDb()

  beforeAll(async () => {
    await AttributeValueModel.syncIndexes()
  })

  it('builds a context of built-ins from live project, ledger, member, and card state', async () => {
    const { ctx, project, card } = await seedProject()

    const context = await buildAttributeContext(ctx, { projectId: project.id, now: NOW })

    expect(lookupAttribute(context, 'org.baseCurrency')?.value).toBe('AUD')
    expect(lookupAttribute(context, 'project.status')?.value).toBe(ProjectStatus.ACTIVE)
    expect(lookupAttribute(context, 'project.budget.approved')?.value).toBe(1_000_000)
    expect(lookupAttribute(context, 'project.budget.actual')?.value).toBe(400_000)
    expect(lookupAttribute(context, 'project.budget.remaining')?.value).toBe(600_000)
    expect(lookupAttribute(context, 'project.budget.utilisationPct')?.value).toBe(40)
    expect(lookupAttribute(context, 'project.headcount')?.value).toBe(1)
    expect(lookupAttribute(context, 'member.role')?.value).toBe('project_spender')
    expect(
      lookupAttribute(context, 'card.purpose', {
        subjectType: AttributeSubjectType.CARD,
        subjectId: card.id,
      })?.value,
    ).toBe(CardPurpose.MEMBER)
  })

  it('merges stored custom values alongside built-ins', async () => {
    const { ctx, project } = await seedProject()
    await putAttributeValue(ctx, {
      key: 'campaign.roas',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 2.4,
      observedAt: NOW.toISOString(),
      source: AttributeSource.WEBHOOK,
      ttlSec: 900,
    })

    const context = await buildAttributeContext(ctx, { projectId: project.id, now: NOW })
    const roas = lookupAttribute(context, 'campaign.roas')

    expect(roas?.value).toBe(2.4)
    expect(roas?.source).toBe(AttributeSource.WEBHOOK)
    expect(roas?.stale).toBe(false)
  })

  it('marks a value past its TTL stale, keeping the observed value rather than zeroing it', async () => {
    const { ctx, project } = await seedProject()
    await putAttributeValue(ctx, {
      key: 'campaign.roas',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 2.4,
      observedAt: '2026-08-10T00:00:00.000Z',
      source: AttributeSource.WEBHOOK,
      ttlSec: 900,
    })

    const context = await buildAttributeContext(ctx, { projectId: project.id, now: NOW })
    const roas = lookupAttribute(context, 'campaign.roas')

    expect(roas?.stale).toBe(true)
    expect(roas?.value).toBe(2.4)

    const requirement = requireAttributes(context, ['campaign.roas'])
    expect(requirement.stale).toEqual(['campaign.roas'])
    expect(requirement.missing).toEqual([])
  })

  it('reports an unknown key as missing so the run fails with the key named', async () => {
    const { ctx, project } = await seedProject()

    const context = await buildAttributeContext(ctx, { projectId: project.id, now: NOW })
    const requirement = requireAttributes(context, [
      'project.budget.remaining',
      'campaign.roas',
      'member.spend.mtd',
    ])

    expect(requirement.missing).toEqual(['campaign.roas', 'member.spend.mtd'])
    expect(requirement.resolved.map((entry) => entry.key)).toEqual(['project.budget.remaining'])
  })

  it('applies simulation overrides as freshly observed values', async () => {
    const { ctx, project } = await seedProject()
    await putAttributeValue(ctx, {
      key: 'campaign.roas',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 1.0,
      observedAt: '2026-08-10T00:00:00.000Z',
      source: AttributeSource.WEBHOOK,
      ttlSec: 900,
    })

    const context = await buildAttributeContext(ctx, {
      projectId: project.id,
      now: NOW,
      overrides: [
        {
          key: 'campaign.roas',
          subjectType: AttributeSubjectType.PROJECT,
          subjectId: project.id,
          value: 4.2,
        },
        {
          key: 'project.budget.remaining',
          subjectType: AttributeSubjectType.PROJECT,
          subjectId: project.id,
          value: 10_000,
        },
      ],
    })

    expect(lookupAttribute(context, 'campaign.roas')?.value).toBe(4.2)
    expect(lookupAttribute(context, 'campaign.roas')?.stale).toBe(false)
    expect(lookupAttribute(context, 'project.budget.remaining')?.value).toBe(10_000)
    expect(context.readings.filter((entry) => entry.key === 'campaign.roas')).toHaveLength(1)
  })

  it('scopes values to the org — another org sees none of them', async () => {
    const { ctx, project } = await seedProject()
    await putAttributeValue(ctx, {
      key: 'campaign.roas',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 2.4,
      source: AttributeSource.WEBHOOK,
    })

    const otherCtx: OrgContext = {
      orgId: '000000000000000000000009',
      userId: 'user_x',
      orgRole: OrgRole.OWNER,
    }
    const context = await buildAttributeContext(otherCtx, { projectId: project.id, now: NOW })

    expect(lookupAttribute(context, 'campaign.roas')).toBeNull()
    expect(lookupAttribute(context, 'project.status')).toBeNull()
  })

  it('treats a null ttlSec as never stale', () => {
    expect(isStale('2020-01-01T00:00:00.000Z', null, NOW)).toBe(false)
    expect(isStale('2026-08-10T00:00:00.000Z', 900, NOW)).toBe(true)
    expect(isStale('2026-08-10T23:59:00.000Z', 900, NOW)).toBe(false)
  })
})
