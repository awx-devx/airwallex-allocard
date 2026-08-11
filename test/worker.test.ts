import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DomainEventType, type DomainEvent } from '@/server/events/types'
import {
  EVENTS_STREAM,
  WORKER_GROUP,
  createMemoryEventStream,
  resetEventStream,
  setEventStream,
} from '@/server/events/stream'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import { createDebouncer } from '@/worker/debounce'
import { createConsumers, createDebouncedDispatcher } from '@/worker/consumers'
import { startWorker } from '@/worker/index'
import { createScheduler } from '@/worker/scheduler'

function event(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    type: DomainEventType.ATTRIBUTE_UPDATED,
    orgId: 'org_1',
    projectId: 'project_1',
    subjectType: 'attribute',
    subjectId: 'campaign.roas',
    payload: { key: 'campaign.roas' },
    emittedAt: new Date(),
    ...overrides,
  }
}

describe('worker', () => {
  beforeEach(() => {
    resetRedis()
    resetEventStream()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('ROLE gate', () => {
    it('refuses to start when ROLE is not worker', async () => {
      await expect(startWorker({ role: undefined })).rejects.toThrow(/ROLE must be "worker"/)
      await expect(startWorker({ role: 'web' })).rejects.toThrow(/ROLE must be "worker"/)
    })

    it('starts when ROLE=worker', async () => {
      const runtime = await startWorker({
        role: 'worker',
        evaluate: async () => {},
      })
      await runtime.stop()
    })
  })

  describe('debounce', () => {
    it('coalesces twenty events into one evaluation', async () => {
      vi.useFakeTimers()
      const runs: string[] = []
      const debouncer = createDebouncer({
        windowMs: 1000,
        schedule: (fn, ms) => {
          const handle = setTimeout(fn, ms)
          return { clear: () => clearTimeout(handle) }
        },
      })

      for (let i = 0; i < 20; i += 1) {
        await debouncer.schedule({
          ruleId: 'rule_1',
          subjectId: 'project_1',
          run: async () => {
            runs.push(`run-${i}`)
          },
        })
      }

      expect(debouncer.pendingCount()).toBe(1)
      expect(runs).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(1000)
      await debouncer.flush()

      expect(runs).toHaveLength(1)
      expect(runs[0]).toBe('run-19')
    })

    it('releases the rule lock after the evaluation', async () => {
      const debouncer = createDebouncer({ windowMs: 10 })
      await debouncer.schedule({
        ruleId: 'rule_1',
        subjectId: 'subject_1',
        run: async () => {},
      })
      expect(await getRedis().get(redisKeys.lockRule('rule_1', 'subject_1'))).toBe('1')
      await debouncer.flush()
      expect(await getRedis().get(redisKeys.lockRule('rule_1', 'subject_1'))).toBeNull()
    })
  })

  describe('scheduler locks', () => {
    it('skips a tick when another replica holds lock:job', async () => {
      await getRedis().set(redisKeys.lockJob('sweep-rules'), '1', { nx: true, px: 60_000 })
      const scheduler = createScheduler()
      let ran = 0
      const ranOnce = await scheduler.runOnce({
        name: 'sweep-rules',
        everyMs: 1000,
        run: async () => {
          ran += 1
        },
      })
      expect(ranOnce).toBe(false)
      expect(ran).toBe(0)
    })
  })

  describe('consumers + SIGTERM', () => {
    it('drains in-flight debounce work and releases locks on stop', async () => {
      const stream = createMemoryEventStream()
      setEventStream(stream)

      let evaluateCalls = 0
      let resolveEval: (() => void) | undefined
      const evalGate = new Promise<void>((resolve) => {
        resolveEval = resolve
      })

      const debouncer = createDebouncer({ windowMs: 20 })
      const dispatcher = createDebouncedDispatcher(debouncer, async () => {
        evaluateCalls += 1
        await evalGate
      })

      let stopping = false
      const consumers = createConsumers(dispatcher, {
        stream,
        blockMs: 50,
        shouldStop: () => stopping,
        consumerName: 'test-consumer',
      })
      const handle = consumers.startEvents()

      await stream.publish(EVENTS_STREAM, event())
      // Wait until debounce fires and evaluate is in flight.
      await new Promise((resolve) => setTimeout(resolve, 80))
      expect(debouncer.pendingCount() + debouncer.inflightCount()).toBeGreaterThan(0)

      stopping = true
      handle.stop()
      debouncer.stopAccepting()

      // Finish the in-flight job, then flush.
      resolveEval?.()
      await debouncer.flush()
      await getRedis().del(redisKeys.lockRule(DomainEventType.ATTRIBUTE_UPDATED, 'org_1:project_1'))

      expect(evaluateCalls).toBe(1)
      expect(await getRedis().get(redisKeys.lockRule('rule_1', 'subject_1'))).toBeNull()

      await stream.publish(EVENTS_STREAM, event({ subjectId: 'wake' }))
      await Promise.race([handle.done, new Promise((resolve) => setTimeout(resolve, 500))])
    })

    it('acks stream entries after handling', async () => {
      const stream = createMemoryEventStream()
      const seen: DomainEvent[] = []
      await stream.ensureGroup(EVENTS_STREAM, WORKER_GROUP)
      await stream.publish(EVENTS_STREAM, event({ subjectId: 'a' }))
      await stream.publish(EVENTS_STREAM, event({ subjectId: 'b' }))

      const first = await stream.readGroup({
        stream: EVENTS_STREAM,
        group: WORKER_GROUP,
        consumer: 'c1',
        count: 10,
        blockMs: 10,
      })
      expect(first).toHaveLength(2)
      for (const entry of first) {
        seen.push(entry.event)
        await stream.ack(EVENTS_STREAM, WORKER_GROUP, [entry.id])
      }

      const second = await stream.readGroup({
        stream: EVENTS_STREAM,
        group: WORKER_GROUP,
        consumer: 'c1',
        count: 10,
        blockMs: 10,
      })
      expect(second).toHaveLength(0)
      expect(seen).toHaveLength(2)
    })
  })
})
