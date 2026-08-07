import { afterEach, describe, expect, it } from 'vitest'
import RedisMock from 'ioredis-mock'
import {
  createIoRedisClient,
  createMemoryRedis,
  redisKeys,
  resetRedis,
  type RedisClient,
} from '@/server/redis'

function sharedRedisContract(name: string, create: () => RedisClient) {
  describe(name, () => {
    let redis: RedisClient

    afterEach(async () => {
      await redis.quit()
      resetRedis()
    })

    it('get/set round-trip', async () => {
      redis = create()
      expect(await redis.get('k')).toBeNull()
      expect(await redis.set('k', 'v')).toBe(true)
      expect(await redis.get('k')).toBe('v')
    })

    it('set NX only writes when missing', async () => {
      redis = create()
      expect(await redis.set('lock', '1', { nx: true })).toBe(true)
      expect(await redis.set('lock', '2', { nx: true })).toBe(false)
      expect(await redis.get('lock')).toBe('1')
    })

    it('set PX expires the key', async () => {
      redis = create()
      expect(await redis.set('ttl', 'x', { px: 30 })).toBe(true)
      expect(await redis.get('ttl')).toBe('x')
      await new Promise((r) => setTimeout(r, 40))
      expect(await redis.get('ttl')).toBeNull()
    })

    it('set NX+PX acquires a lock that expires', async () => {
      redis = create()
      expect(await redis.set('lock:card:1', 'holder', { nx: true, px: 30 })).toBe(true)
      expect(await redis.set('lock:card:1', 'other', { nx: true, px: 30 })).toBe(false)
      await new Promise((r) => setTimeout(r, 40))
      expect(await redis.set('lock:card:1', 'other', { nx: true, px: 30 })).toBe(true)
    })

    it('del removes keys', async () => {
      redis = create()
      await redis.set('a', '1')
      await redis.set('b', '2')
      expect(await redis.del('a', 'missing')).toBe(1)
      expect(await redis.get('a')).toBeNull()
      expect(await redis.get('b')).toBe('2')
    })

    it('incr increments from zero', async () => {
      redis = create()
      expect(await redis.incr('rate')).toBe(1)
      expect(await redis.incr('rate')).toBe(2)
      expect(await redis.get('rate')).toBe('2')
    })
  })
}

sharedRedisContract('memory redis', () => createMemoryRedis())
sharedRedisContract('ioredis redis', () => createIoRedisClient(new RedisMock()))

describe('redisKeys', () => {
  it('matches ARCHITECTURE §10 conventions', () => {
    expect(redisKeys.policyCard('c1')).toBe('policy:card:c1')
    expect(redisKeys.budgetProject('p1')).toBe('budget:project:p1')
    expect(redisKeys.webhook('e1')).toBe('webhook:e1')
    expect(redisKeys.lockCard('c1')).toBe('lock:card:c1')
    expect(redisKeys.lockRule('r1', 's1')).toBe('lock:rule:r1:s1')
    expect(redisKeys.lockJob('reconcile')).toBe('lock:job:reconcile')
    expect(redisKeys.awToken()).toBe('aw:token')
    expect(redisKeys.rateRemoteAuth('c1')).toBe('rate:remote-auth:c1')
  })
})
