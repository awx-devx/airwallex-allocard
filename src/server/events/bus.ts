import type { DomainEvent, DomainEventType } from '@/server/events/types'

export type EventPublisher = (event: DomainEvent) => void | Promise<void>

const published: DomainEvent[] = []
let publisher: EventPublisher = defaultPublisher

function defaultPublisher(event: DomainEvent): void {
  published.push(event)
  console.info('[events] publish', {
    type: event.type,
    orgId: event.orgId,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
  })
}

/**
 * Publish a domain event after the write commits.
 * B1: in-memory + log. B6 replaces the transport with Redis Streams.
 */
export async function publish(event: DomainEvent): Promise<void> {
  await publisher(event)
}

/** Build and publish an event with `emittedAt` set to now. */
export async function publishEvent<TType extends DomainEventType, TPayload>(
  partial: Omit<DomainEvent<TType, TPayload>, 'emittedAt'> & { emittedAt?: Date },
): Promise<DomainEvent<TType, TPayload>> {
  const event: DomainEvent<TType, TPayload> = {
    ...partial,
    emittedAt: partial.emittedAt ?? new Date(),
  }
  await publish(event)
  return event
}

/** Test seam — swap the publisher (e.g. to a spy). */
export function setEventPublisher(next: EventPublisher): void {
  publisher = next
}

export function resetEventPublisher(): void {
  publisher = defaultPublisher
  published.length = 0
}

/** Events captured by the default in-memory publisher (tests). */
export function getPublishedEvents(): readonly DomainEvent[] {
  return published
}
