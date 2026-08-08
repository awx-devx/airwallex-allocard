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
import { seedRoleTemplates } from '../src/server/services/organizations/seedRoleTemplates'
import { ROLE_TEMPLATES } from '../src/shared/constants/roleTemplates'

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
  /** B3 persona emails (org MEMBER + project roles on SEED-ACTIVE). */
  approverEmail: 'approver@allocard.local',
  approverName: 'Seed Approver',
  spenderEmail: 'spender@allocard.local',
  spenderName: 'Seed Spender',
  contractorEmail: 'contractor@allocard.local',
  contractorName: 'Seed Contractor',
  procurementEmail: 'procurement@allocard.local',
  procurementName: 'Seed Procurement',
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

  // B4: await seedB4()
  // B5: await seedB5()
  // B6: await seedB6()
  // B7: await seedB7()
  // B8: await seedB8()
  // B9: await seedB9()
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
