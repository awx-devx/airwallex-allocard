import { afterEach, describe, expect, it } from 'vitest'
import { GET } from '@/app/api/health/route'
import { getHealthStatus } from '@/server/health'
import { getRedis, resetRedis } from '@/server/redis'
import { useTestDb } from '../../../../test/helpers/db'
import { readBody } from '../../../../test/helpers/request'

describe('GET /api/health', () => {
  useTestDb()

  afterEach(() => {
    resetRedis()
  })

  it('returns 200 when mongo and redis are up', async () => {
    getRedis({ url: null })

    const res = await GET()
    const body = await readBody<{
      status: string
      checks: { mongo: boolean; redis: boolean }
    }>(res)

    expect(res.status).toBe(200)
    expect(body).toEqual({
      status: 'ok',
      checks: { mongo: true, redis: true },
    })
  })

  it('returns 503 with mongo failed when Mongo is stopped', async () => {
    getRedis({ url: null })

    const { statusCode, body } = await getHealthStatus({
      pingMongo: async () => {
        throw new Error('MongoDB stopped')
      },
    })

    expect(statusCode).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ mongo: false, redis: true })
    expect(body.failed).toEqual(['mongo'])
  })

  it('returns 503 naming redis when Redis ping fails', async () => {
    const { statusCode, body } = await getHealthStatus({
      pingMongo: async () => undefined,
      pingRedis: async () => {
        throw new Error('Redis down')
      },
    })

    expect(statusCode).toBe(503)
    expect(body.failed).toEqual(['redis'])
    expect(body.checks).toEqual({ mongo: true, redis: false })
  })
})
