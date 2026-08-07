import { afterAll, beforeAll, beforeEach } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'

let memory: MongoMemoryServer | undefined

/** Fresh in-memory Mongo for the current test file. */
export async function setupTestDb(): Promise<void> {
  memory = await MongoMemoryServer.create()
  const dbName = `allocard-test-${process.pid}-${Date.now()}`
  await mongoose.connect(memory.getUri(), { dbName })
}

/** Clear all collections between tests. */
export async function clearCollections(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    return
  }
  const collections = mongoose.connection.collections
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})))
}

export async function teardownTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
  if (memory) {
    await memory.stop()
    memory = undefined
  }
}

/** Wire beforeAll / beforeEach / afterAll for an integration file. */
export function useTestDb(): void {
  beforeAll(async () => {
    await setupTestDb()
  }, 60_000)

  beforeEach(async () => {
    await clearCollections()
  })

  afterAll(async () => {
    await teardownTestDb()
  })
}
