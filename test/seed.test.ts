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

    const users = await mongoose.connection.collection('users').countDocuments({
      email: SEED.ownerEmail,
    })
    const orgs = await mongoose.connection.collection('organizations').countDocuments({
      slug: SEED.orgSlug,
    })
    const memberships = await mongoose.connection.collection('memberships').countDocuments({})

    expect(users).toBe(1)
    expect(orgs).toBe(1)
    expect(memberships).toBe(1)
  })
})
