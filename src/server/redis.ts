import Redis from 'ioredis'
import { loadServerEnv } from '@/server/env'

export type SetOptions = {
  /** Only set if the key does not already exist. */
  nx?: boolean
  /** Expire after this many milliseconds. */
  px?: number
}

/** Minimal Redis surface used by Allocard. */
export type RedisClient = {
  get(key: string): Promise<string | null>
  /** Returns true when the value was set, false when NX blocked the write. */
  set(key: string, value: string, options?: SetOptions): Promise<boolean>
  del(...keys: string[]): Promise<number>
  incr(key: string): Promise<number>
  ping(): Promise<'PONG'>
  quit(): Promise<void>
}

type MemoryEntry = {
  value: string
  expiresAt?: number
}

export function createMemoryRedis(): RedisClient {
  const store = new Map<string, MemoryEntry>()

  function read(key: string): string | null {
    const entry = store.get(key)
    if (!entry) {
      return null
    }
    if (entry.expiresAt !== undefined && Date.now() >= entry.expiresAt) {
      store.delete(key)
      return null
    }
    return entry.value
  }

  return {
    async get(key) {
      return read(key)
    },

    async set(key, value, options = {}) {
      if (options.nx && read(key) !== null) {
        return false
      }
      store.set(key, {
        value,
        expiresAt: options.px !== undefined ? Date.now() + options.px : undefined,
      })
      return true
    },

    async del(...keys) {
      let removed = 0
      for (const key of keys) {
        if (store.delete(key)) {
          removed += 1
        }
      }
      return removed
    },

    async incr(key) {
      const current = read(key)
      const next = (current === null ? 0 : Number(current)) + 1
      if (!Number.isFinite(next)) {
        throw new Error(`ERR value is not an integer or out of range for key ${key}`)
      }
      const existing = store.get(key)
      store.set(key, {
        value: String(next),
        expiresAt: existing?.expiresAt,
      })
      return next
    },

    async ping() {
      return 'PONG' as const
    },

    async quit() {
      store.clear()
    },
  }
}

type IoRedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ...args: Array<string | number>): Promise<string | null>
  del(...keys: string[]): Promise<number>
  incr(key: string): Promise<number>
  ping(): Promise<string>
  quit(): Promise<'OK'>
}

export function createIoRedisClient(client: IoRedisLike | object): RedisClient {
  const redis = client as IoRedisLike
  return {
    async get(key) {
      return redis.get(key)
    },

    async set(key, value, options = {}) {
      const args: Array<string | number> = []
      if (options.px !== undefined) {
        args.push('PX', options.px)
      }
      if (options.nx) {
        args.push('NX')
      }
      const result = await redis.set(key, value, ...args)
      return result === 'OK'
    },

    async del(...keys) {
      if (keys.length === 0) {
        return 0
      }
      return redis.del(...keys)
    },

    async incr(key) {
      return redis.incr(key)
    },

    async ping() {
      const result = await redis.ping()
      if (result !== 'PONG') {
        throw new Error(`Unexpected Redis PING response: ${result}`)
      }
      return 'PONG'
    },

    async quit() {
      await redis.quit()
    },
  }
}

export function createRedisFromUrl(url: string): RedisClient {
  return createIoRedisClient(
    new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    }),
  )
}

/** Key helpers — `docs/ARCHITECTURE.md` §10. */
export const redisKeys = {
  policyCard: (cardId: string) => `policy:card:${cardId}`,
  budgetProject: (projectId: string) => `budget:project:${projectId}`,
  webhook: (eventId: string) => `webhook:${eventId}`,
  lockCard: (cardId: string) => `lock:card:${cardId}`,
  lockRule: (ruleId: string, subjectId: string) => `lock:rule:${ruleId}:${subjectId}`,
  lockJob: (jobName: string) => `lock:job:${jobName}`,
  awToken: () => 'aw:token',
  rateRemoteAuth: (cardId: string) => `rate:remote-auth:${cardId}`,
} as const

let singleton: RedisClient | undefined

/**
 * Lazy Redis client. Uses an in-memory implementation when `REDIS_URL` is unset
 * so B1–B4 can run without Redis.
 */
export function getRedis(options?: { url?: string | null }): RedisClient {
  if (!singleton) {
    const url = options?.url !== undefined ? options.url : loadServerEnv().REDIS_URL
    singleton = url ? createRedisFromUrl(url) : createMemoryRedis()
  }
  return singleton
}

/** Test helper: drop the singleton so the next `getRedis` rebuilds. */
export function resetRedis(): void {
  singleton = undefined
}
