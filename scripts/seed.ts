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
import { connectDb, disconnectDb, type ConnectDbOptions } from '../src/server/db/connect'

export const SEED = {
  ownerEmail: 'owner@allocard.local',
  ownerName: 'Seed Owner',
  orgName: 'Acme Demo',
  orgSlug: 'acme',
  orgCountry: 'US',
  orgBaseCurrency: 'USD',
} as const

type SeedUser = {
  _id: mongoose.Types.ObjectId
  email: string
  name: string
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
 * B1 will extend with extra members and a pending invite.
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

export async function runSeed(options: ConnectDbOptions = {}): Promise<void> {
  await connectDb(options)

  // --- phase sections (append below; do not reorder) ---
  const b0 = await seedB0()
  console.log(`B0: org=${b0.orgId} owner=${b0.userId}`)

  // B1: await seedB1()
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
