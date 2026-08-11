/**
 * Blocking XREADGROUP consumers (ARCHITECTURE §8).
 * Job bodies live in services; this file only decides when they run.
 */
import type { DomainEvent } from '@/server/events/types'
import {
  EVENTS_STREAM,
  WEBHOOKS_STREAM,
  WORKER_GROUP,
  getEventStream,
  type EventStream,
  type StreamEntry,
} from '@/server/events/stream'
import type { Debouncer } from '@/worker/debounce'

export type DomainEventHandler = (event: DomainEvent) => Promise<void>

export type ConsumerOptions = {
  stream?: EventStream
  group?: string
  consumerName?: string
  blockMs?: number
  /** Called when the consumer loop should stop (SIGTERM). */
  shouldStop?: () => boolean
}

export type ConsumerHandle = {
  stop: () => void
  /** Resolves when the loop has exited after stop. */
  done: Promise<void>
}

/**
 * Map a domain event onto debounce subjects. B6.12 wires the real evaluation;
 * here we only expose the dispatch seam the worker will call.
 */
export type EventDispatcher = {
  onDomainEvent: DomainEventHandler
  onWebhookEvent: DomainEventHandler
}

export function createConsumers(
  dispatcher: EventDispatcher,
  options: ConsumerOptions = {},
): { startEvents: () => ConsumerHandle; startWebhooks: () => ConsumerHandle } {
  const stream = options.stream ?? getEventStream()
  const group = options.group ?? WORKER_GROUP
  const blockMs = options.blockMs ?? 1000

  function start(streamName: string, handler: DomainEventHandler): ConsumerHandle {
    let stopped = false
    const consumerName =
      options.consumerName ??
      `worker-${process.pid}-${streamName}-${Math.random().toString(16).slice(2, 8)}`

    const done = (async () => {
      await stream.ensureGroup(streamName, group)
      while (!stopped && !(options.shouldStop?.() ?? false)) {
        const entries = await stream.readGroup({
          stream: streamName,
          group,
          consumer: consumerName,
          count: 20,
          blockMs,
        })
        if (stopped) {
          break
        }
        for (const entry of entries) {
          await handler(entry.event)
          await stream.ack(streamName, group, [entry.id])
        }
      }
    })()

    return {
      stop: () => {
        stopped = true
      },
      done,
    }
  }

  return {
    startEvents: () => start(EVENTS_STREAM, dispatcher.onDomainEvent),
    startWebhooks: () => start(WEBHOOKS_STREAM, dispatcher.onWebhookEvent),
  }
}

/**
 * Default dispatcher for B6.11 — records and debounces by subject.
 * B6.12 replaces `evaluate` with `evaluateAndApply`.
 */
export function createDebouncedDispatcher(
  debouncer: Debouncer,
  evaluate: (event: DomainEvent) => Promise<void>,
): EventDispatcher {
  return {
    async onDomainEvent(event) {
      const subjectId = event.projectId ?? event.subjectId
      // One debounce key per event type + subject until B6.12 maps to rule ids.
      await debouncer.schedule({
        ruleId: event.type,
        subjectId: `${event.orgId}:${subjectId}`,
        run: () => evaluate(event),
      })
    },
    async onWebhookEvent(event) {
      await debouncer.schedule({
        ruleId: `webhook:${event.type}`,
        subjectId: `${event.orgId}:${event.subjectId}`,
        run: () => evaluate(event),
      })
    },
  }
}

export type { StreamEntry }
