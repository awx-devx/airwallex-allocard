/**
 * Redis Streams transport for domain events (ARCHITECTURE §8).
 * Memory implementation for tests; ioredis for production.
 */
import type { DomainEvent } from '@/server/events/types'

export const EVENTS_STREAM = 'events'
export const WEBHOOKS_STREAM = 'webhooks'
export const WORKER_GROUP = 'allocard-workers'

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

let singleton: EventStream | undefined

export function getEventStream(): EventStream {
  if (!singleton) {
    singleton = createMemoryEventStream()
  }
  return singleton
}

export function setEventStream(next: EventStream): void {
  singleton = next
}

export function resetEventStream(): void {
  singleton = createMemoryEventStream()
}
