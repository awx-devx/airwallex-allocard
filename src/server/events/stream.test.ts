import { afterEach, describe, expect, it } from 'vitest'
import { DomainEventType, type DomainEvent } from '@/server/events/types'
import {
  WORKER_GROUP,
  createMemoryEventStream,
  createRedisEventStream,
  deserializeDomainEvent,
  type StreamRedis,
} from '@/server/events/stream'

function sampleEvent(subjectId: string): DomainEvent {
  return {
    type: DomainEventType.PROJECT_LAUNCHED,
    orgId: 'org_1',
    projectId: 'proj_1',
    subjectType: 'project',
    subjectId,
    payload: { projectId: 'proj_1' },
    emittedAt: new Date('2026-08-11T12:00:00.000Z'),
  }
}

/**
 * Minimal XADD / XGROUP / XREADGROUP / XACK stand-in.
 * ioredis-mock 8 does not implement Redis Streams (compat.md).
 */
function createFakeStreamRedis(): StreamRedis {
  const entries = new Map<string, Array<{ id: string; fields: string[] }>>()
  const groups = new Map<string, Set<string>>()
  let seq = 0

  function groupKey(stream: string, group: string): string {
    return `${stream}:${group}`
  }

  return {
    async xadd(...args) {
      const stream = String(args[0])
      const fields = args.slice(2).map(String)
      seq += 1
      const id = `0-${seq}`
      const list = entries.get(stream) ?? []
      list.push({ id, fields })
      entries.set(stream, list)
      return id
    },

    async xgroup(...args) {
      const command = String(args[0])
      if (command !== 'CREATE') {
        return 'OK'
      }
      const stream = String(args[1])
      const group = String(args[2])
      const key = groupKey(stream, group)
      if (groups.has(key)) {
        throw new Error('BUSYGROUP Consumer Group name already exists')
      }
      groups.set(key, new Set())
      if (!entries.has(stream)) {
        entries.set(stream, [])
      }
      return 'OK'
    },

    async xreadgroup(...args) {
      const group = String(args[1])
      const countIndex = args.findIndex((value) => String(value) === 'COUNT')
      const streamsIndex = args.findIndex((value) => String(value) === 'STREAMS')
      const count = countIndex >= 0 ? Number(args[countIndex + 1]) : 10
      const stream = streamsIndex >= 0 ? String(args[streamsIndex + 1]) : ''
      const delivered = groups.get(groupKey(stream, group))
      if (!delivered) {
        return null
      }
      const unread = (entries.get(stream) ?? []).filter((entry) => !delivered.has(entry.id))
      const taken = unread.slice(0, count)
      for (const entry of taken) {
        delivered.add(entry.id)
      }
      if (taken.length === 0) {
        return null
      }
      return [[stream, taken.map((entry) => [entry.id, entry.fields])]]
    },

    async xack(...args) {
      return args.length - 2
    },
  }
}

function sharedStreamContract(
  name: string,
  create: () => {
    stream: ReturnType<typeof createMemoryEventStream>
    cleanup: () => Promise<void>
  },
) {
  describe(name, () => {
    let cleanup: () => Promise<void> = async () => undefined

    afterEach(async () => {
      await cleanup()
    })

    it('publishes, reads via the worker group, and acks', async () => {
      const created = create()
      cleanup = created.cleanup
      const { stream } = created
      const id = await stream.publish('events', sampleEvent('proj_1'))
      expect(id.length).toBeGreaterThan(0)

      await stream.ensureGroup('events', WORKER_GROUP)
      const entries = await stream.readGroup({
        stream: 'events',
        group: WORKER_GROUP,
        consumer: 'c1',
        count: 10,
        blockMs: 50,
      })
      expect(entries).toHaveLength(1)
      expect(entries[0]?.event.type).toBe(DomainEventType.PROJECT_LAUNCHED)
      expect(entries[0]?.event.emittedAt).toEqual(new Date('2026-08-11T12:00:00.000Z'))
      expect(entries[0]?.event.subjectId).toBe('proj_1')

      expect(await stream.ack('events', WORKER_GROUP, [entries[0]!.id])).toBe(1)

      const again = await stream.readGroup({
        stream: 'events',
        group: WORKER_GROUP,
        consumer: 'c2',
        count: 10,
        blockMs: 20,
      })
      expect(again).toHaveLength(0)
    })

    it('ensureGroup is idempotent', async () => {
      const created = create()
      cleanup = created.cleanup
      await created.stream.ensureGroup('events', WORKER_GROUP)
      await created.stream.ensureGroup('events', WORKER_GROUP)
    })
  })
}

sharedStreamContract('memory event stream', () => ({
  stream: createMemoryEventStream(),
  cleanup: async () => undefined,
}))

sharedStreamContract('redis event stream', () => ({
  stream: createRedisEventStream(createFakeStreamRedis()),
  cleanup: async () => undefined,
}))

describe('redis event stream (two clients)', () => {
  it('publishes on one wrapper and consumes on another sharing the store', async () => {
    const redis = createFakeStreamRedis()
    const publisher = createRedisEventStream(redis)
    const worker = createRedisEventStream(redis)

    await publisher.publish('events', sampleEvent('proj_shared'))
    await worker.ensureGroup('events', WORKER_GROUP)
    const entries = await worker.readGroup({
      stream: 'events',
      group: WORKER_GROUP,
      consumer: 'worker-1',
      count: 10,
      blockMs: 20,
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.event.subjectId).toBe('proj_shared')
    expect(await worker.ack('events', WORKER_GROUP, [entries[0]!.id])).toBe(1)
  })
})

describe('deserializeDomainEvent', () => {
  it('revives emittedAt from an ISO string', () => {
    const json = JSON.stringify(sampleEvent('p'))
    const event = deserializeDomainEvent(json)
    expect(event.emittedAt).toEqual(new Date('2026-08-11T12:00:00.000Z'))
    expect(event.type).toBe(DomainEventType.PROJECT_LAUNCHED)
  })
})
