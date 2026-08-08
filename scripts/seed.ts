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

export async function runSeed(options: ConnectDbOptions = {}): Promise<void> {
  await connectDb(options)

  // --- phase sections (append below; do not reorder) ---
  const b0 = await seedB0()
  console.log(`B0: org=${b0.orgId} owner=${b0.userId}`)

  const b1 = await seedB1({ orgId: b0.orgId, ownerId: b0.userId })
  console.log(
    `B1: admin=${b1.adminId} member=${b1.memberId} invite=${b1.inviteCreated ? 'created' : 'exists'}`,
  )

  // B2: await seedB2()
  // B3: await seedB3()
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
