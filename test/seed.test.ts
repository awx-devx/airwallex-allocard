import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { disconnectDb } from '@/server/db/connect'
import { runSeed, SEED } from '../scripts/seed'

describe('pnpm seed idempotency', () => {
  let memory: MongoMemoryServer
  let uri: string

  beforeAll(async () => {
    memory = await MongoMemoryServer.create()
    uri = memory.getUri()
  }, 60_000)

  afterAll(async () => {
    await disconnectDb()
    await memory.stop()
  })

  it('succeeds twice with no duplicates', async () => {
    await disconnectDb()
    await runSeed({ uri, dbName: 'allocard-seed' })
    await disconnectDb()
    await runSeed({ uri, dbName: 'allocard-seed' })

    const ownerUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.ownerEmail,
    })
    const adminUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.adminEmail,
    })
    const memberUsers = await mongoose.connection.collection('users').countDocuments({
      email: SEED.memberEmail,
    })
    const orgs = await mongoose.connection.collection('organizations').countDocuments({
      slug: SEED.orgSlug,
    })
    const memberships = await mongoose.connection.collection('memberships').countDocuments({})
    const pendingInvites = await mongoose.connection.collection('invites').countDocuments({
      email: SEED.pendingInviteEmail,
      status: 'PENDING',
    })
    const projects = await mongoose.connection.collection('projects').countDocuments({})
    const draft = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectDraftCode,
      status: 'DRAFT',
    })
    const active = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectActiveCode,
      status: 'ACTIVE',
    })
    const closing = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectClosingCode,
      status: 'CLOSING',
    })
    const closed = await mongoose.connection.collection('projects').countDocuments({
      code: SEED.projectClosedCode,
      status: 'CLOSED',
    })

    expect(ownerUsers).toBe(1)
    expect(adminUsers).toBe(1)
    expect(memberUsers).toBe(1)
    expect(orgs).toBe(1)
    expect(memberships).toBe(3)
    expect(pendingInvites).toBe(1)
    expect(projects).toBe(4)
    expect(draft).toBe(1)
    expect(active).toBe(1)
    expect(closing).toBe(1)
    expect(closed).toBe(1)
  })
})
