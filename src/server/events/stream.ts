/**
 * Redis Streams transport for domain events (ARCHITECTURE §8).
 * Memory implementation for tests; ioredis when REDIS_URL is set.
 */
import Redis from 'ioredis'
import type { DomainEvent } from '@/server/events/types'
import { loadServerEnv } from '@/server/env'

export const EVENTS_STREAM = 'events'
export const WEBHOOKS_STREAM = 'webhooks'
export const WORKER_GROUP = 'allocard-workers'

/** JSON field name on each stream entry. */
const EVENT_FIELD = 'event'

/** ioredis stream commands used by the production transport. */
export type StreamRedis = {
  xadd(...args: Array<string | number>): Promise<string | null>
  xgroup(...args: Array<string | number>): Promise<unknown>
  xreadgroup(...args: Array<string | number>): Promise<unknown>
  xack(...args: Array<string | number>): Promise<number>
}

export type StreamEntry = {
  id: string
  stream: string
  event: DomainEvent
}

export type EventStream = {
  publish(stream: string, event: DomainEvent): Promise<string>
  ensureGroup(stream: string, group: string): Promise<void>
  /** Blocking read; `blockMs: 0` waits forever. Returns [] on timeout. */
  readGroup(options: {
    stream: string
    group: string
    consumer: string
    count?: number
    blockMs?: number
  }): Promise<StreamEntry[]>
  ack(stream: string, group: string, ids: string[]): Promise<number>
}

type MemoryRecord = {
  id: string
  event: DomainEvent
  pending: Set<string>
}

export function createMemoryEventStream(): EventStream {
  const streams = new Map<string, MemoryRecord[]>()
  const groups = new Map<string, Set<string>>()
  let seq = 0
  const waiters: Array<() => void> = []

  function wake(): void {
    while (waiters.length > 0) {
      waiters.shift()?.()
    }
  }

  function records(stream: string): MemoryRecord[] {
    let list = streams.get(stream)
    if (!list) {
      list = []
      streams.set(stream, list)
    }
    return list
  }

  return {
    async publish(stream, event) {
      seq += 1
      const id = `${Date.now()}-${seq}`
      records(stream).push({ id, event, pending: new Set() })
      wake()
      return id
    },

    async ensureGroup(stream, group) {
      const key = `${stream}:${group}`
      if (!groups.has(key)) {
        groups.set(key, new Set())
      }
      // Touch the stream so it exists even before the first publish.
      void records(stream)
    },

    async readGroup({ stream, group, consumer, count = 10, blockMs = 0 }) {
      await this.ensureGroup(stream, group)
      const groupKey = `${stream}:${group}`
      const delivered = groups.get(groupKey)!

      const take = (): StreamEntry[] => {
        const out: StreamEntry[] = []
        for (const record of records(stream)) {
          if (delivered.has(record.id)) {
            continue
          }
          delivered.add(record.id)
          record.pending.add(consumer)
          out.push({ id: record.id, stream, event: record.event })
          if (out.length >= count) {
            break
          }
        }
        return out
      }

      const immediate = take()
      if (immediate.length > 0) {
        return immediate
      }

      if (blockMs < 0) {
        return []
      }

      await new Promise<void>((resolve) => {
        let settled = false
        const finish = () => {
          if (settled) {
            return
          }
          settled = true
          resolve()
        }
        waiters.push(finish)
        if (blockMs > 0) {
          setTimeout(() => {
            const index = waiters.indexOf(finish)
            if (index >= 0) {
              waiters.splice(index, 1)
            }
            finish()
          }, blockMs)
        }
      })
      return take()
    },

    async ack(stream, group, ids) {
      let n = 0
      for (const record of records(stream)) {
        if (ids.includes(record.id)) {
          record.pending.clear()
          n += 1
        }
      }
      void group
      return n
    },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }
  if (Buffer.isBuffer(value)) {
    return value.toString('utf8')
  }
  return String(value)
}

function fieldValue(fields: unknown, name: string): string | null {
  if (!Array.isArray(fields)) {
    return null
  }
  for (let i = 0; i + 1 < fields.length; i += 2) {
    if (asString(fields[i]) === name) {
      return asString(fields[i + 1])
    }
  }
  return null
}

export function deserializeDomainEvent(json: string): DomainEvent {
  const parsed: unknown = JSON.parse(json)
  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    throw new Error('Invalid domain event on stream')
  }
  const emittedAt = parsed.emittedAt
  return {
    ...(parsed as Omit<DomainEvent, 'emittedAt'>),
    emittedAt:
      typeof emittedAt === 'string' || emittedAt instanceof Date ? new Date(emittedAt) : new Date(),
  }
}

function parseReadGroupReply(stream: string, raw: unknown): StreamEntry[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: StreamEntry[] = []
  for (const block of raw) {
    if (!Array.isArray(block) || block.length < 2) {
      continue
    }
    const messages = block[1]
    if (!Array.isArray(messages)) {
      continue
    }
    for (const message of messages) {
      if (!Array.isArray(message) || message.length < 2) {
        continue
      }
      const json = fieldValue(message[1], EVENT_FIELD)
      if (json === null) {
        continue
      }
      out.push({
        id: asString(message[0]),
        stream,
        event: deserializeDomainEvent(json),
      })
    }
  }
  return out
}

function isBusyGroup(error: unknown): boolean {
  return error instanceof Error && error.message.includes('BUSYGROUP')
}

/** Production transport: XADD / XGROUP / XREADGROUP / XACK on a shared Redis. */
export function createRedisEventStream(redis: StreamRedis): EventStream {
  return {
    async publish(stream, event) {
      const id = await redis.xadd(stream, '*', EVENT_FIELD, JSON.stringify(event))
      if (id === null || id.length < 1) {
        throw new Error(`XADD to ${stream} returned no id`)
      }
      return id
    },

    async ensureGroup(stream, group) {
      try {
        await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM')
      } catch (error) {
        if (isBusyGroup(error)) {
          return
        }
        throw error
      }
    },

    async readGroup({ stream, group, consumer, count = 10, blockMs = 0 }) {
      if (blockMs < 0) {
        return []
      }
      await this.ensureGroup(stream, group)
      const raw = await redis.xreadgroup(
        'GROUP',
        group,
        consumer,
        'COUNT',
        count,
        'BLOCK',
        blockMs,
        'STREAMS',
        stream,
        '>',
      )
      return parseReadGroupReply(stream, raw)
    },

    async ack(stream, group, ids) {
      if (ids.length === 0) {
        return 0
      }
      return redis.xack(stream, group, ...ids)
    },
  }
}

function createDefaultEventStream(): EventStream {
  if (process.env.VITEST === 'true') {
    return createMemoryEventStream()
  }
  const url = loadServerEnv().REDIS_URL
  if (!url) {
    return createMemoryEventStream()
  }
  // ioredis overloads for xadd/xreadgroup are not assignable to a rest-args surface.
  return createRedisEventStream(
    new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    }) as unknown as StreamRedis,
  )
}

let singleton: EventStream | undefined

export function getEventStream(): EventStream {
  if (!singleton) {
    singleton = createDefaultEventStream()
  }
  return singleton
}

export function setEventStream(next: EventStream): void {
  singleton = next
}

export function resetEventStream(): void {
  singleton = createMemoryEventStream()
}
