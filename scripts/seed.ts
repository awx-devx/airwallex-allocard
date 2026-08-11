/**
 * Database seed — idempotent, safe to re-run.
 *
 * Each phase appends its own `seedB*()` section below. Do not rewrite earlier
 * sections; extend them.
 *
 * Usage: `pnpm seed` (requires a valid `.env` with at least `MONGODB_URI` and
 * the other vars from `.env.example`).
 */
import mongoose from 'mongoose'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { hashPassword } from '../src/server/auth/password'
import { connectDb, disconnectDb, type ConnectDbOptions } from '../src/server/db/connect'
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
} from '../src/server/services/invites/token'
import { evaluateFormula } from '../src/server/lib/formula'
import * as budgets from '../src/server/repositories/budgets'
import { appendBudgetEntry } from '../src/server/services/budget/ledger'
import { seedRoleTemplates } from '../src/server/services/organizations/seedRoleTemplates'
import { ROLE_TEMPLATES } from '../src/shared/constants/roleTemplates'
import { BudgetEntrySourceType } from '../src/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '../src/shared/enums/budgetEntryType'
import { OrgRole } from '../src/shared/enums/orgRole'

export const SEED = {
  ownerEmail: 'owner@allocard.local',
  ownerName: 'Seed Owner',
  orgName: 'Acme Demo',
  orgSlug: 'acme',
  orgCountry: 'US',
  orgBaseCurrency: 'USD',
  /** Shared credentials password for seeded personas (demo sign-in). */
  password: 'password123',
  adminEmail: 'admin@allocard.local',
  adminName: 'Seed Admin',
  memberEmail: 'member@allocard.local',
  memberName: 'Seed Member',
  pendingInviteEmail: 'pending@allocard.local',
  /** Stable project codes for idempotent B2 seed (unique per org). */
  projectDraftCode: 'SEED-DRAFT',
  projectActiveCode: 'SEED-ACTIVE',
  projectClosingCode: 'SEED-CLOSING',
  projectClosedCode: 'SEED-CLOSED',
  /** B9 — fully archived project with final report snapshot. */
  projectArchivedCode: 'SEED-ARCHIVED',
  /** B3 persona emails (org MEMBER + project roles on SEED-ACTIVE). */
  approverEmail: 'approver@allocard.local',
  approverName: 'Seed Approver',
  spenderEmail: 'spender@allocard.local',
  spenderName: 'Seed Spender',
  contractorEmail: 'contractor@allocard.local',
  contractorName: 'Seed Contractor',
  procurementEmail: 'procurement@allocard.local',
  procurementName: 'Seed Procurement',
  /** B4 — SEED-ACTIVE budget (integer minor units). */
  budgetApprovedAmount: 500_000,
  budgetAdjustmentAmount: -10_000,
  budgetMediaAllocated: 100_000,
  budgetOpsFormula: 'pct(approvedAmount, 20)',
} as const

type SeedUser = {
  _id: mongoose.Types.ObjectId
  email: string
  name: string
  passwordHash?: string
  defaultOrgId?: string
  createdAt: Date
}

type SeedOrg = {
  _id: mongoose.Types.ObjectId
  name: string
  slug: string
  country: string
  baseCurrency: string
  costCentres: string[]
  airwallexAccountId: null
  settings: { defaultApprovalPolicy: null; notifications: Record<string, never> }
  createdBy: string
  createdAt: Date
}

async function upsertOwner(): Promise<SeedUser> {
  const users = mongoose.connection.collection<SeedUser>('users')
  const email = SEED.ownerEmail.toLowerCase()

  const existing = await users.findOne({ email })
  if (existing) {
    return existing
  }

  const doc: SeedUser = {
    _id: new mongoose.Types.ObjectId(),
    email,
    name: SEED.ownerName,
    createdAt: new Date(),
  }
  await users.insertOne(doc)
  return doc
}

async function upsertOrg(createdBy: string): Promise<SeedOrg> {
  const orgs = mongoose.connection.collection<SeedOrg>('organizations')

  const existing = await orgs.findOne({ slug: SEED.orgSlug })
  if (existing) {
    return existing
  }

  const doc: SeedOrg = {
    _id: new mongoose.Types.ObjectId(),
    name: SEED.orgName,
    slug: SEED.orgSlug,
    country: SEED.orgCountry,
    baseCurrency: SEED.orgBaseCurrency,
    costCentres: [],
    airwallexAccountId: null,
    settings: { defaultApprovalPolicy: null, notifications: {} },
    createdBy,
    createdAt: new Date(),
  }
  await orgs.insertOne(doc)
  return doc
}

async function upsertOwnerMembership(orgId: string, userId: string): Promise<void> {
  const memberships = mongoose.connection.collection('memberships')
  await memberships.updateOne(
    { orgId, userId },
    {
      $setOnInsert: {
        orgId,
        userId,
        orgRole: 'OWNER',
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    },
    { upsert: true },
  )
}

/**
 * B0 — one organisation and one owner membership.
 * B1 extends with extra members and a pending invite.
 */
export async function seedB0(): Promise<{ orgId: string; userId: string }> {
  const user = await upsertOwner()
  const userId = String(user._id)

  const org = await upsertOrg(userId)
  const orgId = String(org._id)

  await upsertOwnerMembership(orgId, userId)

  await mongoose.connection
    .collection('users')
    .updateOne({ _id: user._id }, { $set: { defaultOrgId: orgId } })

  return { orgId, userId }
}

async function upsertMemberUser(email: string, name: string, orgId: string): Promise<SeedUser> {
  const users = mongoose.connection.collection<SeedUser>('users')
  const normalised = email.toLowerCase()
  const existing = await users.findOne({ email: normalised })
  if (existing) {
    if (!existing.defaultOrgId) {
      await users.updateOne({ _id: existing._id }, { $set: { defaultOrgId: orgId } })
    }
    return existing
  }

  const passwordHash = await hashPassword(SEED.password)
  const doc: SeedUser = {
    _id: new mongoose.Types.ObjectId(),
    email: normalised,
    name,
    passwordHash,
    defaultOrgId: orgId,
    createdAt: new Date(),
  }
  await users.insertOne(doc)
  return doc
}

async function upsertMembership(
  orgId: string,
  userId: string,
  orgRole: 'ADMIN' | 'MEMBER',
): Promise<void> {
  const memberships = mongoose.connection.collection('memberships')
  await memberships.updateOne(
    { orgId, userId },
    {
      $setOnInsert: {
        orgId,
        userId,
        orgRole,
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    },
    { upsert: true },
  )
}

async function upsertPendingInvite(
  orgId: string,
  invitedBy: string,
): Promise<{ created: boolean }> {
  const invites = mongoose.connection.collection('invites')
  const email = SEED.pendingInviteEmail.toLowerCase()
  const existing = await invites.findOne({ orgId, email, status: 'PENDING' })
  if (existing) {
    return { created: false }
  }

  const token = generateInviteToken()
  const tokenHash = hashInviteToken(token)
  await invites.insertOne({
    _id: new mongoose.Types.ObjectId(),
    orgId,
    email,
    orgRole: 'MEMBER',
    tokenHash,
    expiresAt: inviteExpiresAt(),
    status: 'PENDING',
    invitedBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  console.info('[seed] pending invite accept link', {
    email,
    path: `/accept-invite/${token}`,
  })
  return { created: true }
}

/**
 * B1 — two additional org members (ADMIN + MEMBER) and one pending invite.
 */
export async function seedB1(input: {
  orgId: string
  ownerId: string
}): Promise<{ adminId: string; memberId: string; inviteCreated: boolean }> {
  const admin = await upsertMemberUser(SEED.adminEmail, SEED.adminName, input.orgId)
  const member = await upsertMemberUser(SEED.memberEmail, SEED.memberName, input.orgId)
  const adminId = String(admin._id)
  const memberId = String(member._id)

  await upsertMembership(input.orgId, adminId, 'ADMIN')
  await upsertMembership(input.orgId, memberId, 'MEMBER')

  const { created: inviteCreated } = await upsertPendingInvite(input.orgId, input.ownerId)

  return { adminId, memberId, inviteCreated }
}

type SeedProjectStatus = 'DRAFT' | 'ACTIVE' | 'CLOSING' | 'CLOSED'

type SeedProjectSpec = {
  code: string
  name: string
  status: SeedProjectStatus
  description: string
}

const defaultCardStructure = {
  shared: false,
  perMember: false,
  vendor: false,
  oneTime: false,
}

async function upsertProject(
  orgId: string,
  ownerId: string,
  spec: SeedProjectSpec,
): Promise<{ id: string; created: boolean }> {
  const projects = mongoose.connection.collection('projects')
  const existing = await projects.findOne({ orgId, code: spec.code })
  if (existing) {
    return { id: String(existing._id), created: false }
  }

  const now = new Date()
  const startDate = new Date('2026-01-01T00:00:00.000Z')
  const endDate = new Date('2026-12-31T00:00:00.000Z')
  const _id = new mongoose.Types.ObjectId()

  await projects.insertOne({
    _id,
    orgId,
    name: spec.name,
    code: spec.code,
    description: spec.description,
    status: spec.status,
    ownerId,
    costCentre: 'DEMO',
    startDate,
    endDate,
    workstreams: [{ id: 'ws-demo', name: 'General' }],
    cardStructure: defaultCardStructure,
    approvedAt: spec.status === 'DRAFT' ? null : now,
    launchedAt:
      spec.status === 'ACTIVE' || spec.status === 'CLOSING' || spec.status === 'CLOSED'
        ? now
        : null,
    closedAt: spec.status === 'CLOSED' ? now : null,
    createdAt: now,
    updatedAt: now,
  })

  return { id: String(_id), created: true }
}

/**
 * B2 — projects at key lifecycle stages for A2 (DRAFT, ACTIVE, CLOSING, CLOSED).
 * Idempotent on `(orgId, code)`.
 */
export async function seedB2(input: { orgId: string; ownerId: string }): Promise<{
  draftId: string
  activeId: string
  closingId: string
  closedId: string
  createdCount: number
}> {
  const specs: SeedProjectSpec[] = [
    {
      code: SEED.projectDraftCode,
      name: 'Seed Draft Project',
      status: 'DRAFT',
      description: 'Wizard-in-progress demo project',
    },
    {
      code: SEED.projectActiveCode,
      name: 'Seed Active Project',
      status: 'ACTIVE',
      description: 'Launched demo project',
    },
    {
      code: SEED.projectClosingCode,
      name: 'Seed Closing Project',
      status: 'CLOSING',
      description: 'Winding-down demo project',
    },
    {
      code: SEED.projectClosedCode,
      name: 'Seed Closed Project',
      status: 'CLOSED',
      description: 'Completed demo project',
    },
  ]

  const results = []
  for (const spec of specs) {
    results.push(await upsertProject(input.orgId, input.ownerId, spec))
  }

  return {
    draftId: results[0]!.id,
    activeId: results[1]!.id,
    closingId: results[2]!.id,
    closedId: results[3]!.id,
    createdCount: results.filter((r) => r.created).length,
  }
}

type SeedScope =
  { level: 'PROJECT' } | { level: 'OWN' } | { level: 'WORKSTREAM'; workstreamIds: string[] }

async function roleIdByKey(orgId: string, key: string): Promise<string> {
  const role = await mongoose.connection.collection('roles').findOne({ orgId, key })
  if (!role) {
    throw new Error(`Seed role template missing for key=${key}`)
  }
  return String(role._id)
}

function permissionsForTemplate(key: string): string[] {
  const template = ROLE_TEMPLATES.find((t) => t.key === key)
  if (!template) {
    throw new Error(`Unknown role template key=${key}`)
  }
  return [...template.permissions]
}

async function upsertProjectMember(input: {
  orgId: string
  projectId: string
  userId: string
  roleKey: string
  scope: SeedScope
  addedBy: string
}): Promise<{ created: boolean }> {
  const projectMembers = mongoose.connection.collection('projectMembers')
  const existing = await projectMembers.findOne({
    orgId: input.orgId,
    projectId: input.projectId,
    userId: input.userId,
    removedAt: null,
  })
  if (existing) {
    return { created: false }
  }

  const roleId = await roleIdByKey(input.orgId, input.roleKey)
  const now = new Date()
  await projectMembers.insertOne({
    _id: new mongoose.Types.ObjectId(),
    orgId: input.orgId,
    projectId: input.projectId,
    userId: input.userId,
    roleId,
    scope: input.scope,
    effectivePermissions: permissionsForTemplate(input.roleKey),
    addedBy: input.addedBy,
    addedAt: now,
    removedAt: null,
    createdAt: now,
    updatedAt: now,
  })
  return { created: true }
}

/**
 * B3 — role templates for the demo org; ACTIVE (+ draft viewer) project members
 * spanning several templates/scopes for A3 people & access.
 * Idempotent on role `(orgId, key)` and active membership `(orgId, projectId, userId)`.
 */
export async function seedB3(input: {
  orgId: string
  ownerId: string
  adminId: string
  memberId: string
  activeProjectId: string
  draftProjectId: string
}): Promise<{ roleKeys: number; createdMembers: number }> {
  await seedRoleTemplates(input.orgId)

  const approver = await upsertMemberUser(SEED.approverEmail, SEED.approverName, input.orgId)
  const spender = await upsertMemberUser(SEED.spenderEmail, SEED.spenderName, input.orgId)
  const contractor = await upsertMemberUser(SEED.contractorEmail, SEED.contractorName, input.orgId)
  const procurement = await upsertMemberUser(
    SEED.procurementEmail,
    SEED.procurementName,
    input.orgId,
  )

  const approverId = String(approver._id)
  const spenderId = String(spender._id)
  const contractorId = String(contractor._id)
  const procurementId = String(procurement._id)

  await upsertMembership(input.orgId, approverId, 'MEMBER')
  await upsertMembership(input.orgId, spenderId, 'MEMBER')
  await upsertMembership(input.orgId, contractorId, 'MEMBER')
  await upsertMembership(input.orgId, procurementId, 'MEMBER')

  const memberships: Array<{
    userId: string
    projectId: string
    roleKey: string
    scope: SeedScope
  }> = [
    {
      userId: input.ownerId,
      projectId: input.activeProjectId,
      roleKey: 'finance_administrator',
      scope: { level: 'PROJECT' },
    },
    {
      userId: input.adminId,
      projectId: input.activeProjectId,
      roleKey: 'project_manager',
      scope: { level: 'PROJECT' },
    },
    {
      userId: input.memberId,
      projectId: input.activeProjectId,
      roleKey: 'viewer',
      scope: { level: 'OWN' },
    },
    {
      userId: approverId,
      projectId: input.activeProjectId,
      roleKey: 'approver',
      scope: { level: 'PROJECT' },
    },
    {
      userId: spenderId,
      projectId: input.activeProjectId,
      roleKey: 'project_spender',
      scope: { level: 'WORKSTREAM', workstreamIds: ['ws-demo'] },
    },
    {
      userId: contractorId,
      projectId: input.activeProjectId,
      roleKey: 'contractor',
      scope: { level: 'OWN' },
    },
    {
      userId: procurementId,
      projectId: input.activeProjectId,
      roleKey: 'procurement_lead',
      scope: { level: 'PROJECT' },
    },
    {
      userId: input.memberId,
      projectId: input.draftProjectId,
      roleKey: 'viewer',
      scope: { level: 'PROJECT' },
    },
  ]

  let createdMembers = 0
  for (const row of memberships) {
    const result = await upsertProjectMember({
      orgId: input.orgId,
      projectId: row.projectId,
      userId: row.userId,
      roleKey: row.roleKey,
      scope: row.scope,
      addedBy: input.ownerId,
    })
    if (result.created) {
      createdMembers += 1
    }
  }

  return { roleKeys: ROLE_TEMPLATES.length, createdMembers }
}

/**
 * B4 — idempotent budget on SEED-ACTIVE: approved amount, 2 categories
 * (one formula), APPROVAL + ADJUSTMENT entries, matching Project.budgetSnapshot.
 */
export async function seedB4(input: {
  orgId: string
  ownerId: string
  activeProjectId: string
}): Promise<{ budgetId: string; created: boolean; entryCount: number }> {
  const ctx = {
    orgId: input.orgId,
    userId: input.ownerId,
    orgRole: OrgRole.OWNER,
  }

  const existing = await budgets.findBudgetByProject(ctx, input.activeProjectId)
  if (existing) {
    const entryCount = await mongoose.connection.collection('budgetEntries').countDocuments({
      orgId: input.orgId,
      projectId: input.activeProjectId,
    })
    return { budgetId: existing.id, created: false, entryCount }
  }

  const approvedAmount = SEED.budgetApprovedAmount
  const budget = await budgets.upsertBudgetFields(ctx, input.activeProjectId, {
    currency: SEED.orgBaseCurrency,
    approvedAmount,
    thresholdPcts: [80, 90, 100],
  })

  const opsAllocated = evaluateFormula(SEED.budgetOpsFormula, { approvedAmount })
  await budgets.addCategory(ctx, input.activeProjectId, {
    name: 'Media',
    allocated: SEED.budgetMediaAllocated,
  })
  await budgets.addCategory(ctx, input.activeProjectId, {
    name: 'Ops',
    allocated: opsAllocated,
    formula: SEED.budgetOpsFormula,
  })

  await appendBudgetEntry(ctx, input.activeProjectId, {
    type: BudgetEntryType.APPROVAL,
    amount: approvedAmount,
    currency: SEED.orgBaseCurrency,
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: budget.id,
    createdBy: input.ownerId,
    note: 'seed.approval',
  })

  await appendBudgetEntry(ctx, input.activeProjectId, {
    type: BudgetEntryType.ADJUSTMENT,
    amount: SEED.budgetAdjustmentAmount,
    currency: SEED.orgBaseCurrency,
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: budget.id,
    createdBy: input.ownerId,
    note: 'seed.adjustment',
  })

  const finalApproved = approvedAmount + SEED.budgetAdjustmentAmount
  await budgets.upsertBudgetFields(ctx, input.activeProjectId, {
    currency: SEED.orgBaseCurrency,
    approvedAmount: finalApproved,
    thresholdPcts: [80, 90, 100],
  })

  const entryCount = await mongoose.connection.collection('budgetEntries').countDocuments({
    orgId: input.orgId,
    projectId: input.activeProjectId,
  })

  return { budgetId: budget.id, created: true, entryCount }
}

/**
 * B5 — idempotent cardholder + card on SEED-ACTIVE under fixture mode.
 * READY INDIVIDUAL for spender; one DELEGATE; one ACTIVE MEMBER card with
 * desiredControls === appliedControls.
 */
export async function seedB5(input: {
  orgId: string
  ownerId: string
  activeProjectId: string
}): Promise<{
  individualCardholderId: string
  delegateCardholderId: string
  cardId: string
  created: boolean
}> {
  const { ensureIndividualCardholder } = await import('../src/server/services/cardholders/ensure')
  const { createCardholderForOrg } = await import('../src/server/services/cardholders/create')
  const { createCardForProject } = await import('../src/server/services/cards/create')
  const cardholdersRepo = await import('../src/server/repositories/cardholders')
  const cardsRepo = await import('../src/server/repositories/cards')
  const { CardholderType } = await import('../src/shared/enums/cardholderType')
  const { CardholderStatus } = await import('../src/shared/enums/cardholderStatus')
  const { CardPurpose } = await import('../src/shared/enums/cardPurpose')
  const { AllowedTransactionCount } = await import('../src/shared/enums/allowedTransactionCount')
  const { TransactionLimitInterval } = await import('../src/shared/enums/transactionLimitInterval')

  const ctx = {
    orgId: input.orgId,
    userId: input.ownerId,
    orgRole: OrgRole.OWNER,
  }

  const existingCards = await cardsRepo.listCards(ctx, {
    projectId: input.activeProjectId,
    purpose: CardPurpose.MEMBER,
    page: 1,
    pageSize: 1,
  })
  if (existingCards.total > 0) {
    const card = existingCards.items[0]!
    const individual =
      (await cardholdersRepo.findCardholderById(ctx, card.cardholderId)) ??
      (await cardholdersRepo.listCardholders(ctx, { type: CardholderType.INDIVIDUAL, pageSize: 1 }))
        .items[0]
    const delegate = (
      await cardholdersRepo.listCardholders(ctx, { type: CardholderType.DELEGATE, pageSize: 1 })
    ).items[0]
    return {
      individualCardholderId: individual?.id ?? card.cardholderId,
      delegateCardholderId: delegate?.id ?? card.cardholderId,
      cardId: card.id,
      created: false,
    }
  }

  const spender = await mongoose.connection
    .collection('users')
    .findOne({ email: SEED.spenderEmail })
  if (!spender) {
    throw new Error('seedB5: spender user missing — run seedB3 first')
  }
  const spenderId = String(spender._id)

  let individual = await ensureIndividualCardholder(ctx, spenderId)
  if (individual.status !== CardholderStatus.READY) {
    await cardholdersRepo.updateCardholderStatus(ctx, individual.id, CardholderStatus.READY)
    individual = (await cardholdersRepo.findCardholderById(ctx, individual.id))!
  }

  let delegate = (
    await cardholdersRepo.listCardholders(ctx, { type: CardholderType.DELEGATE, pageSize: 1 })
  ).items[0]
  if (!delegate) {
    delegate = await createCardholderForOrg(ctx, { type: CardholderType.DELEGATE })
    if (delegate.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, delegate.id, CardholderStatus.READY)
      delegate = (await cardholdersRepo.findCardholderById(ctx, delegate.id))!
    }
  }

  const controls = {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: SEED.orgBaseCurrency,
      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [] as { transactionScope: string; usageScope: string }[],
  }

  const card = await createCardForProject(ctx, input.activeProjectId, {
    purpose: CardPurpose.MEMBER,
    cardholderId: individual.id,
    nickName: 'SEED-ACTIVE — Spender',
    accessList: [spenderId],
    desiredControls: controls,
  })

  return {
    individualCardholderId: individual.id,
    delegateCardholderId: delegate.id,
    cardId: card.id,
    created: true,
  }
}

/**
 * B6 — sample attributes, two enabled rules on SEED-ACTIVE (budget floor +
 * member-limit formula), and one recorded RuleRun. Idempotent.
 */
export async function seedB6(input: {
  orgId: string
  ownerId: string
  activeProjectId: string
  cardId: string
}): Promise<{
  attributeKey: string
  ruleIds: string[]
  ruleRunId: string | null
  created: boolean
}> {
  const definitions = await import('../src/server/repositories/attributeDefinitions')
  const values = await import('../src/server/repositories/attributeValues')
  const rulesRepo = await import('../src/server/repositories/rules')
  const runsRepo = await import('../src/server/repositories/ruleRuns')
  const { AttributeScope } = await import('../src/shared/enums/attributeScope')
  const { AttributeSource } = await import('../src/shared/enums/attributeSource')
  const { AttributeSubjectType } = await import('../src/shared/enums/attributeSubjectType')
  const { AttributeType } = await import('../src/shared/enums/attributeType')
  const { ConditionOperator } = await import('../src/shared/enums/conditionOperator')
  const { RuleActionType } = await import('../src/shared/enums/ruleActionType')
  const { RuleScopeLevel } = await import('../src/shared/enums/ruleScopeLevel')
  const { RuleTargetSelect } = await import('../src/shared/enums/ruleTargetSelect')
  const { CardPurpose } = await import('../src/shared/enums/cardPurpose')
  const { TransactionLimitInterval } = await import('../src/shared/enums/transactionLimitInterval')
  const { ActorType } = await import('../src/shared/enums/audit')
  const { RuleRunStatus } = await import('../src/shared/enums/ruleRunStatus')

  const ctx = {
    orgId: input.orgId,
    userId: input.ownerId,
    orgRole: OrgRole.OWNER,
  }

  const existingRules = await rulesRepo.listRules(ctx, {
    projectId: input.activeProjectId,
    pageSize: 10,
  })
  if (existingRules.total >= 2) {
    const runs = await runsRepo.listRuleRuns(ctx, {
      projectId: input.activeProjectId,
      pageSize: 1,
    })
    return {
      attributeKey: 'campaign.roas',
      ruleIds: existingRules.items.map((rule) => rule.id),
      ruleRunId: runs.items[0]?.id ?? null,
      created: false,
    }
  }

  const existingDef = await definitions.findAttributeDefinitionByKey(ctx, 'campaign.roas')
  if (!existingDef) {
    await definitions.createAttributeDefinition(ctx, {
      key: 'campaign.roas',
      label: 'Campaign ROAS',
      type: AttributeType.NUMBER,
      unit: 'ratio',
      scope: AttributeScope.PROJECT,
      source: AttributeSource.MANUAL,
    })
  }
  await values.putAttributeValue(ctx, {
    key: 'campaign.roas',
    subjectType: AttributeSubjectType.PROJECT,
    subjectId: input.activeProjectId,
    value: 3.5,
    source: AttributeSource.MANUAL,
    ttlSec: 3600,
  })

  const limitRule = await rulesRepo.createRule(ctx, {
    scope: { level: RuleScopeLevel.PROJECT, projectId: input.activeProjectId },
    name: 'Member limits track remaining budget',
    description: 'SEED — 10% of remaining budget (worked example C cousin)',
    enabled: true,
    priority: 50,
    trigger: { events: ['budget.updated', 'attribute.updated'] },
    when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
    then: [
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.PROJECT_CARDS, filter: { purpose: CardPurpose.MEMBER } },
        params: {
          transactionLimits: {
            currency: SEED.orgBaseCurrency,
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
    createdBy: input.ownerId,
  })
  await rulesRepo.setRuleEnabled(ctx, limitRule.id, true)

  const freezeRule = await rulesRepo.createRule(ctx, {
    scope: { level: RuleScopeLevel.PROJECT, projectId: input.activeProjectId },
    name: 'Freeze member cards when budget drops below 10%',
    description: 'SEED — RULES-ENGINE §6 B',
    enabled: true,
    priority: 10,
    trigger: { events: ['budget.updated'] },
    when: {
      attr: 'project.budget.utilisationPct',
      op: ConditionOperator.CROSSED_ABOVE,
      value: 90,
    },
    then: [
      {
        action: RuleActionType.CARD_FREEZE,
        target: { select: RuleTargetSelect.PROJECT_CARDS, filter: { purpose: CardPurpose.MEMBER } },
        params: { reason: 'Project budget below 10% remaining' },
      },
    ],
    createdBy: input.ownerId,
  })
  await rulesRepo.setRuleEnabled(ctx, freezeRule.id, true)

  const now = new Date()
  const run = await runsRepo.createRuleRun(ctx, {
    ruleId: limitRule.id,
    triggeredBy: 'system',
    triggeredByType: ActorType.SYSTEM,
    triggerEvent: 'budget.updated',
    inputs: [
      {
        key: 'project.budget.remaining',
        subjectType: AttributeSubjectType.PROJECT,
        subjectId: input.activeProjectId,
        value: SEED.budgetApprovedAmount + SEED.budgetAdjustmentAmount,
        observedAt: now.toISOString(),
        ttlSec: null,
        stale: false,
      },
    ],
    matched: true,
    desiredState: {
      cards: [
        {
          cardId: input.cardId,
          controls: {
            transactionLimits: {
              currency: SEED.orgBaseCurrency,
              limits: [
                {
                  interval: TransactionLimitInterval.MONTHLY,
                  amount: Math.trunc(
                    (SEED.budgetApprovedAmount + SEED.budgetAdjustmentAmount) * 0.1,
                  ),
                },
              ],
            },
          },
        },
      ],
    },
    diff: {
      cards: [
        {
          cardId: input.cardId,
          before: { controls: null, cardStatus: null },
          after: {
            controls: {
              transactionLimits: {
                currency: SEED.orgBaseCurrency,
                limits: [
                  {
                    interval: TransactionLimitInterval.MONTHLY,
                    amount: Math.trunc(
                      (SEED.budgetApprovedAmount + SEED.budgetAdjustmentAmount) * 0.1,
                    ),
                  },
                ],
              },
            },
            cardStatus: null,
          },
          changed: true,
        },
      ],
    },
    actions: [],
    conflicts: [],
    status: RuleRunStatus.SUCCESS,
    durationMs: 12,
    startedAt: now,
    finishedAt: now,
    projectId: input.activeProjectId,
  })

  return {
    attributeKey: 'campaign.roas',
    ruleIds: [limitRule.id, freezeRule.id],
    ruleRunId: run.id,
    created: true,
  }
}

/**
 * B7 — one approval rule + one PENDING purchase request on SEED-ACTIVE.
 * Idempotent: skips when a PENDING request already exists for the project.
 */
export async function seedB7(input: {
  orgId: string
  ownerId: string
  activeProjectId: string
}): Promise<{ requestId: string; ruleId: string; created: boolean }> {
  const purchaseRequests = await import('../src/server/repositories/purchaseRequests')
  const approvalRules = await import('../src/server/repositories/approvalRules')
  const requests = await import('../src/server/services/approvals/requests')
  const { ApproverSelection } = await import('../src/shared/enums/approverSelection')
  const { PurchaseRequestStatus } = await import('../src/shared/enums/purchaseRequestStatus')

  const ctx = {
    orgId: input.orgId,
    userId: input.ownerId,
    orgRole: OrgRole.OWNER,
  }

  const existingPending = await purchaseRequests.listPendingForApprover(ctx, {
    projectIds: [input.activeProjectId],
    pageSize: 1,
  })
  if (existingPending.total > 0) {
    const rules = await approvalRules.listApprovalRules(ctx, input.activeProjectId)
    return {
      requestId: existingPending.items[0]!.id,
      ruleId: rules[0]?.id ?? '',
      created: false,
    }
  }

  const rules = await approvalRules.replaceProjectRules(ctx, input.activeProjectId, [
    {
      // Low enough that the seeded request (50_000) requires approval.
      threshold: 10_000,
      approverSelection: { type: ApproverSelection.PROJECT_OWNER },
      requiredCount: 1,
      escalationAfterMins: 240,
      escalateTo: { type: ApproverSelection.ROLE, roleKey: 'approver' },
    },
  ])

  const draft = await requests.createPurchaseRequest(ctx, input.activeProjectId, {
    amount: 50_000,
    currency: SEED.orgBaseCurrency,
    vendor: 'Seed Vendor Co',
    description: 'SEED — sample purchase awaiting approval',
    justification: 'Demo pending request for SEED-ACTIVE',
  })
  const submitted = await requests.submitPurchaseRequest(ctx, draft.id)
  if (submitted.status !== PurchaseRequestStatus.PENDING) {
    throw new Error(
      `seedB7 expected PENDING after submit, got ${submitted.status} (outcome=${submitted.policyDecision?.outcome})`,
    )
  }

  return {
    requestId: submitted.id,
    ruleId: rules[0]!.id,
    created: true,
  }
}

/**
 * B8 — sample transactions + one webhook fixture on SEED-ACTIVE.
 * Idempotent on (orgId, airwallexTransactionId).
 */
export async function seedB8(input: {
  orgId: string
  ownerId: string
  activeProjectId: string
  cardId: string
}): Promise<{ transactionCount: number; webhookCreated: boolean }> {
  const transactions = mongoose.connection.collection('transactions')
  const webhookEventsCol = mongoose.connection.collection('webhookEvents')
  const { TransactionStatus } = await import('../src/shared/enums/transactionStatus')
  const { TransactionType } = await import('../src/shared/enums/transactionType')

  const existing = await transactions.countDocuments({ orgId: input.orgId })
  if (existing > 0) {
    return { transactionCount: existing, webhookCreated: false }
  }

  const now = new Date()
  const lifecycleId = 'lc_seed_001'
  const txBase = {
    orgId: input.orgId,
    cardId: input.cardId,
    projectId: input.activeProjectId,
    currency: 'USD',
    billingCurrency: 'USD',
    merchant: { name: 'Seed Vendor Co', mcc: '5411', country: 'US' },
    failureReason: null,
    receiptFileId: null,
    createdAt: now,
    updatedAt: now,
  }

  await transactions.insertMany([
    {
      _id: new mongoose.Types.ObjectId(),
      ...txBase,
      airwallexTransactionId: 'awx_tx_seed_auth_001',
      cardTransactionId: 'ctx_seed_auth_001',
      lifecycleId,
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 25_000,
      billingAmount: 25_000,
      transactedAt: new Date('2026-08-01T10:00:00Z'),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      ...txBase,
      airwallexTransactionId: 'awx_tx_seed_clear_001',
      cardTransactionId: 'ctx_seed_clear_001',
      lifecycleId,
      type: TransactionType.CLEARING,
      status: TransactionStatus.CLEARED,
      amount: 25_000,
      billingAmount: 25_000,
      transactedAt: new Date('2026-08-02T10:00:00Z'),
    },
    {
      _id: new mongoose.Types.ObjectId(),
      ...txBase,
      airwallexTransactionId: 'awx_tx_seed_decline_001',
      cardTransactionId: 'ctx_seed_decline_001',
      lifecycleId: 'lc_seed_002',
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.DECLINED,
      amount: 100_000,
      billingAmount: 100_000,
      failureReason: 'insufficient_funds',
      transactedAt: new Date('2026-08-03T10:00:00Z'),
    },
  ])

  const webhookExists = await webhookEventsCol.findOne({ eventId: 'ev_seed_001' })
  let webhookCreated = false
  if (!webhookExists) {
    await webhookEventsCol.insertOne({
      _id: new mongoose.Types.ObjectId(),
      eventId: 'ev_seed_001',
      name: 'card_transaction.authorization_created',
      accountId: null,
      payload: {
        name: 'card_transaction.authorization_created',
        data: { object: { card_id: input.cardId, transaction_amount: 250.0 } },
      },
      receivedAt: now,
      processedAt: now,
      status: 'PROCESSED',
      attempts: 1,
      error: null,
      createdAt: now,
      updatedAt: now,
    })
    webhookCreated = true
  }

  return { transactionCount: 3, webhookCreated }
}

/**
 * B9 — closure mid-flow + archived final report + sample activity sources.
 * Idempotent on projectClosures `(orgId, projectId)` and project code SEED-ARCHIVED.
 */
export async function seedB9(input: {
  orgId: string
  ownerId: string
  closingProjectId: string
  activeProjectId: string
  cardId: string
}): Promise<{
  closingClosureId: string | null
  archivedProjectId: string
  archivedClosureId: string | null
  activitySources: number
}> {
  const { ClosureStep } = await import('../src/shared/enums/closureStep')
  const { ClosureStepStatus } = await import('../src/shared/enums/closureStepStatus')
  const { ActorType } = await import('../src/shared/enums/audit')

  const projectClosures = mongoose.connection.collection('projectClosures')
  const projects = mongoose.connection.collection('projects')
  const auditLogs = mongoose.connection.collection('auditLogs')
  const transactions = mongoose.connection.collection('transactions')
  const ruleRuns = mongoose.connection.collection('ruleRuns')
  const { TransactionStatus } = await import('../src/shared/enums/transactionStatus')
  const { TransactionType } = await import('../src/shared/enums/transactionType')

  const now = new Date()

  // --- CLOSING mid-flow: PREFLIGHT+FREEZE DONE, currentStep SETTLE ---
  let closingClosureId: string | null = null
  const existingClosing = await projectClosures.findOne({
    orgId: input.orgId,
    projectId: input.closingProjectId,
  })
  if (existingClosing) {
    closingClosureId = String(existingClosing._id)
  } else {
    const closingSteps = (
      Object.values(ClosureStep) as Array<(typeof ClosureStep)[keyof typeof ClosureStep]>
    ).map((step) => {
      if (step === ClosureStep.PREFLIGHT || step === ClosureStep.FREEZE) {
        return {
          step,
          status: ClosureStepStatus.DONE,
          startedAt: now,
          completedAt: now,
          detail: null,
        }
      }
      return {
        step,
        status: ClosureStepStatus.PENDING,
        startedAt: null,
        completedAt: null,
        detail: null,
      }
    })
    const _id = new mongoose.Types.ObjectId()
    await projectClosures.insertOne({
      _id,
      orgId: input.orgId,
      projectId: input.closingProjectId,
      currentStep: ClosureStep.SETTLE,
      steps: closingSteps,
      startedBy: input.ownerId,
      startedAt: now,
      completedAt: null,
      finalReportSnapshot: null,
      createdAt: now,
      updatedAt: now,
    })
    closingClosureId = String(_id)
  }

  // --- ARCHIVED project with final report ---
  let archivedProjectId: string
  const existingArchived = await projects.findOne({
    orgId: input.orgId,
    code: SEED.projectArchivedCode,
  })
  if (existingArchived) {
    archivedProjectId = String(existingArchived._id)
  } else {
    const _id = new mongoose.Types.ObjectId()
    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-06-30T00:00:00.000Z')
    await projects.insertOne({
      _id,
      orgId: input.orgId,
      name: 'Seed Archived Project',
      code: SEED.projectArchivedCode,
      description: 'Fully closed and archived demo project with final report',
      status: 'ARCHIVED',
      ownerId: input.ownerId,
      costCentre: 'DEMO',
      startDate,
      endDate,
      workstreams: [{ id: 'ws-demo', name: 'General' }],
      cardStructure: defaultCardStructure,
      approvedAt: now,
      launchedAt: now,
      closedAt: now,
      budgetSnapshot: {
        approved: 100_000,
        committed: 0,
        actual: 25_000,
        remaining: 75_000,
        utilisationPct: 25,
        overCommitted: false,
        updatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    })
    archivedProjectId = String(_id)
  }

  let archivedClosureId: string | null = null
  const existingArchivedClosure = await projectClosures.findOne({
    orgId: input.orgId,
    projectId: archivedProjectId,
  })
  if (existingArchivedClosure) {
    archivedClosureId = String(existingArchivedClosure._id)
  } else {
    const archivedSteps = (
      Object.values(ClosureStep) as Array<(typeof ClosureStep)[keyof typeof ClosureStep]>
    ).map((step) => ({
      step,
      status: ClosureStepStatus.DONE,
      startedAt: now,
      completedAt: now,
      detail: null,
    }))
    const finalReportSnapshot = {
      projectId: archivedProjectId,
      currency: 'USD',
      approved: 100_000,
      committed: 0,
      actual: 25_000,
      remaining: 75_000,
      utilisationPct: 25,
      byCategory: [],
      byMember: [],
      generatedAt: now.toISOString(),
      closedAt: now.toISOString(),
      archivedAt: now.toISOString(),
      transactionCount: 1,
      accessHistoryCount: 0,
    }
    const _id = new mongoose.Types.ObjectId()
    await projectClosures.insertOne({
      _id,
      orgId: input.orgId,
      projectId: archivedProjectId,
      currentStep: ClosureStep.ARCHIVE,
      steps: archivedSteps,
      startedBy: input.ownerId,
      startedAt: now,
      completedAt: now,
      finalReportSnapshot,
      createdAt: now,
      updatedAt: now,
    })
    archivedClosureId = String(_id)
  }

  // --- Sample activity sources (audit + cleared tx + rule run) ---
  let activitySources = 0

  const auditKey = 'seed_b9_closure_started'
  const existingAudit = await auditLogs.findOne({
    orgId: input.orgId,
    action: 'project.closure_started',
    subjectId: input.closingProjectId,
    'metadata.seedKey': auditKey,
  })
  if (!existingAudit) {
    await auditLogs.insertOne({
      _id: new mongoose.Types.ObjectId(),
      orgId: input.orgId,
      projectId: input.closingProjectId,
      actorType: ActorType.USER,
      actorId: input.ownerId,
      action: 'project.closure_started',
      subjectType: 'project',
      subjectId: input.closingProjectId,
      before: { status: 'ACTIVE' },
      after: { status: 'CLOSING' },
      metadata: { seedKey: auditKey, currentStep: 'SETTLE' },
      at: now,
    })
    activitySources += 1
  }

  const archivedAuditKey = 'seed_b9_closure_completed'
  const existingArchivedAudit = await auditLogs.findOne({
    orgId: input.orgId,
    action: 'project.closure_completed',
    subjectId: archivedProjectId,
    'metadata.seedKey': archivedAuditKey,
  })
  if (!existingArchivedAudit) {
    await auditLogs.insertOne({
      _id: new mongoose.Types.ObjectId(),
      orgId: input.orgId,
      projectId: archivedProjectId,
      actorType: ActorType.USER,
      actorId: input.ownerId,
      action: 'project.closure_completed',
      subjectType: 'project',
      subjectId: archivedProjectId,
      before: { status: 'CLOSING' },
      after: { status: 'ARCHIVED' },
      metadata: {
        seedKey: archivedAuditKey,
        closedAt: now.toISOString(),
        archivedAt: now.toISOString(),
        transactionCount: 1,
        accessHistoryCount: 0,
      },
      at: now,
    })
    activitySources += 1
  }

  const finalReportAuditKey = 'seed_b9_final_report'
  const existingFinalAudit = await auditLogs.findOne({
    orgId: input.orgId,
    action: 'report.final_generated',
    subjectId: archivedProjectId,
    'metadata.seedKey': finalReportAuditKey,
  })
  if (!existingFinalAudit) {
    await auditLogs.insertOne({
      _id: new mongoose.Types.ObjectId(),
      orgId: input.orgId,
      projectId: archivedProjectId,
      actorType: ActorType.USER,
      actorId: input.ownerId,
      action: 'report.final_generated',
      subjectType: 'project',
      subjectId: archivedProjectId,
      before: null,
      after: {
        approved: 100_000,
        actual: 25_000,
        remaining: 75_000,
        transactionCount: 1,
      },
      metadata: { seedKey: finalReportAuditKey, step: 'FINAL_REPORT' },
      at: now,
    })
    activitySources += 1
  }

  const seedTxId = 'awx_tx_seed_b9_archived_001'
  const existingTx = await transactions.findOne({
    orgId: input.orgId,
    airwallexTransactionId: seedTxId,
  })
  if (!existingTx) {
    await transactions.insertOne({
      _id: new mongoose.Types.ObjectId(),
      orgId: input.orgId,
      cardId: input.cardId,
      projectId: archivedProjectId,
      airwallexTransactionId: seedTxId,
      cardTransactionId: 'ctx_seed_b9_001',
      lifecycleId: 'lc_seed_b9_001',
      type: TransactionType.CLEARING,
      status: TransactionStatus.CLEARED,
      amount: 25_000,
      currency: 'USD',
      billingAmount: 25_000,
      billingCurrency: 'USD',
      merchant: { name: 'Archived Seed Vendor', mcc: '5411', country: 'US' },
      failureReason: null,
      receiptFileId: null,
      transactedAt: new Date('2026-05-01T12:00:00Z'),
      createdAt: now,
      updatedAt: now,
    })
    activitySources += 1
  }

  const { RuleRunStatus } = await import('../src/shared/enums/ruleRunStatus')
  const seedRunKey = 'seed_b9_activity_run'
  const existingRun = await ruleRuns.findOne({
    orgId: input.orgId,
    projectId: input.activeProjectId,
    triggerEvent: seedRunKey,
  })
  if (!existingRun) {
    // Prefer attaching to an existing seed rule when present.
    const existingRule = await mongoose.connection.collection('rules').findOne({
      orgId: input.orgId,
      'scope.projectId': input.activeProjectId,
    })
    const ruleId = existingRule ? String(existingRule._id) : 'seed_b9_rule_placeholder'
    await ruleRuns.insertOne({
      _id: new mongoose.Types.ObjectId(),
      orgId: input.orgId,
      ruleId,
      triggeredBy: input.ownerId,
      triggeredByType: ActorType.USER,
      triggerEvent: seedRunKey,
      inputs: [],
      matched: false,
      desiredState: {},
      diff: {},
      actions: [],
      conflicts: [],
      status: RuleRunStatus.SKIPPED,
      skipReason: 'SEED activity sample',
      failureReason: null,
      durationMs: 1,
      startedAt: now,
      finishedAt: now,
      cardIds: [input.cardId],
      projectId: input.activeProjectId,
      createdAt: now,
      updatedAt: now,
    })
    activitySources += 1
  }

  return {
    closingClosureId,
    archivedProjectId,
    archivedClosureId,
    activitySources,
  }
}

export async function runSeed(options: ConnectDbOptions = {}): Promise<void> {
  await connectDb(options)

  // --- phase sections (append below; do not reorder) ---
  const b0 = await seedB0()
  console.log(`B0: org=${b0.orgId} owner=${b0.userId}`)

  const b1 = await seedB1({ orgId: b0.orgId, ownerId: b0.userId })
  console.log(
    `B1: admin=${b1.adminId} member=${b1.memberId} invite=${b1.inviteCreated ? 'created' : 'exists'}`,
  )

  const b2 = await seedB2({ orgId: b0.orgId, ownerId: b0.userId })
  console.log(
    `B2: draft=${b2.draftId} active=${b2.activeId} closing=${b2.closingId} closed=${b2.closedId} created=${b2.createdCount}`,
  )

  const b3 = await seedB3({
    orgId: b0.orgId,
    ownerId: b0.userId,
    adminId: b1.adminId,
    memberId: b1.memberId,
    activeProjectId: b2.activeId,
    draftProjectId: b2.draftId,
  })
  console.log(`B3: roleTemplates=${b3.roleKeys} projectMembersCreated=${b3.createdMembers}`)

  const b4 = await seedB4({
    orgId: b0.orgId,
    ownerId: b0.userId,
    activeProjectId: b2.activeId,
  })
  console.log(`B4: budget=${b4.budgetId} created=${b4.created} entries=${b4.entryCount}`)

  const b5 = await seedB5({
    orgId: b0.orgId,
    ownerId: b0.userId,
    activeProjectId: b2.activeId,
  })
  console.log(
    `B5: card=${b5.cardId} individual=${b5.individualCardholderId} delegate=${b5.delegateCardholderId} created=${b5.created}`,
  )

  const b6 = await seedB6({
    orgId: b0.orgId,
    ownerId: b0.userId,
    activeProjectId: b2.activeId,
    cardId: b5.cardId,
  })
  console.log(
    `B6: attr=${b6.attributeKey} rules=${b6.ruleIds.length} run=${b6.ruleRunId} created=${b6.created}`,
  )

  const b7 = await seedB7({
    orgId: b0.orgId,
    ownerId: b0.userId,
    activeProjectId: b2.activeId,
  })
  console.log(`B7: request=${b7.requestId} rule=${b7.ruleId} created=${b7.created}`)

  const b8 = await seedB8({
    orgId: b0.orgId,
    ownerId: b0.userId,
    activeProjectId: b2.activeId,
    cardId: b5.cardId,
  })
  console.log(
    `B8: transactions=${b8.transactionCount} webhook=${b8.webhookCreated ? 'created' : 'exists'}`,
  )

  const b9 = await seedB9({
    orgId: b0.orgId,
    ownerId: b0.userId,
    closingProjectId: b2.closingId,
    activeProjectId: b2.activeId,
    cardId: b5.cardId,
  })
  console.log(
    `B9: closingClosure=${b9.closingClosureId} archived=${b9.archivedProjectId} activitySources=${b9.activitySources}`,
  )
}

async function main(): Promise<void> {
  try {
    await runSeed()
    console.log('Seed complete.')
  } finally {
    await disconnectDb()
  }
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ''
if (import.meta.url === entry) {
  main().catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
}
