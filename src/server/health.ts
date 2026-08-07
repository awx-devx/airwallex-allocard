import mongoose from 'mongoose'
import { connectDb } from '@/server/db/connect'
import { getRedis } from '@/server/redis'

export type HealthCheckName = 'mongo' | 'redis'

export type HealthBody = {
  status: 'ok' | 'degraded'
  checks: { mongo: boolean; redis: boolean }
  failed?: HealthCheckName[]
}

export type HealthResult = {
  statusCode: number
  body: HealthBody
}

export type HealthDeps = {
  pingMongo?: () => Promise<void>
  pingRedis?: () => Promise<void>
}

async function defaultPingMongo(): Promise<void> {
  if (mongoose.connection.readyState !== 1) {
    await connectDb()
  }
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('MongoDB is not connected')
  }
  await db.admin().command({ ping: 1 })
}

async function defaultPingRedis(): Promise<void> {
  const pong = await getRedis().ping()
  if (pong !== 'PONG') {
    throw new Error('Redis PING failed')
  }
}

/** Check Mongo and Redis. Used by `GET /api/health` and Railway. */
export async function getHealthStatus(deps: HealthDeps = {}): Promise<HealthResult> {
  const pingMongo = deps.pingMongo ?? defaultPingMongo
  const pingRedis = deps.pingRedis ?? defaultPingRedis

  const checks = { mongo: false, redis: false }
  const failed: HealthCheckName[] = []

  try {
    await pingMongo()
    checks.mongo = true
  } catch {
    failed.push('mongo')
  }

  try {
    await pingRedis()
    checks.redis = true
  } catch {
    failed.push('redis')
  }

  const ok = failed.length === 0
  return {
    statusCode: ok ? 200 : 503,
    body: {
      status: ok ? 'ok' : 'degraded',
      checks,
      ...(failed.length > 0 ? { failed } : {}),
    },
  }
}
