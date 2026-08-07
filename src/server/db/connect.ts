import mongoose from 'mongoose'
import { loadServerEnv } from '@/server/env'

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var mongooseCache: MongooseCache | undefined
}

const cache: MongooseCache = globalThis.mongooseCache ?? { conn: null, promise: null }
globalThis.mongooseCache = cache

export type ConnectDbOptions = {
  uri?: string
  dbName?: string
}

/**
 * Idempotent Mongoose connect. Cached on `globalThis` so Next.js HMR does not
 * open a new connection per reload. Concurrent callers share one promise.
 */
export async function connectDb(options: ConnectDbOptions = {}): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn
  }

  // Reuse a connection opened outside this helper (e.g. test harness).
  if (mongoose.connection.readyState === 1) {
    cache.conn = mongoose
    return cache.conn
  }

  if (!cache.promise) {
    let uri = options.uri
    let dbName = options.dbName
    if (uri === undefined || dbName === undefined) {
      const env = loadServerEnv()
      uri = uri ?? env.MONGODB_URI
      dbName = dbName ?? env.MONGODB_DB
    }

    cache.promise = mongoose.connect(uri, { dbName }).then((m) => m)
  }

  try {
    cache.conn = await cache.promise
  } catch (error) {
    cache.promise = null
    throw error
  }

  return cache.conn
}

/** Test/helper: clear the HMR cache and disconnect. */
export async function disconnectDb(): Promise<void> {
  if (cache.promise || cache.conn) {
    await mongoose.disconnect()
  }
  cache.conn = null
  cache.promise = null
}
