/**
 * Webhook events are global (shared Airwallex account — ARCHITECTURE D1).
 * Idempotent insert on `eventId`; duplicate → existing document.
 */
import { WebhookEventModel } from '@/server/models/WebhookEvent'
import { toDomain } from '@/server/models/base'
import { WebhookEventStatus } from '@/shared/enums/webhookEventStatus'
import type { WebhookEvent } from '@/shared/types/webhookEvent'

export type InsertWebhookEventInput = {
  eventId: string
  name: string
  accountId?: string | null
  payload: Record<string, unknown>
  receivedAt: Date
  status?: WebhookEventStatus
  attempts?: number
  error?: string | null
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  )
}

function nullableIso(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return String(value)
}

function toWebhookEvent(doc: Parameters<typeof toDomain>[0]): WebhookEvent {
  const raw = toDomain<Record<string, unknown>>(doc)
  return {
    id: String(raw.id),
    eventId: String(raw.eventId),
    name: String(raw.name),
    accountId: raw.accountId == null ? null : String(raw.accountId),
    payload:
      raw.payload !== null && typeof raw.payload === 'object' && !Array.isArray(raw.payload)
        ? (raw.payload as Record<string, unknown>)
        : {},
    receivedAt: String(raw.receivedAt),
    processedAt: nullableIso(raw.processedAt),
    status: raw.status as WebhookEventStatus,
    attempts: Number(raw.attempts),
    error: raw.error == null ? null : String(raw.error),
  }
}

/**
 * Insert or return existing on duplicate `eventId`.
 * Race-safe: concurrent inserts converge on the unique index.
 */
export async function insertWebhookEvent(
  input: InsertWebhookEventInput,
): Promise<{ event: WebhookEvent; created: boolean }> {
  try {
    const doc = await WebhookEventModel.create({
      eventId: input.eventId,
      name: input.name,
      accountId: input.accountId === undefined ? null : input.accountId,
      payload: input.payload,
      receivedAt: input.receivedAt,
      status: input.status ?? WebhookEventStatus.RECEIVED,
      attempts: input.attempts ?? 0,
      error: input.error === undefined ? null : input.error,
    })
    return { event: toWebhookEvent(doc), created: true }
  } catch (error) {
    if (!isDuplicateKey(error)) {
      throw error
    }
    const existing = await WebhookEventModel.findOne({ eventId: input.eventId }).lean().exec()
    if (!existing) {
      throw error
    }
    return { event: toWebhookEvent(existing), created: false }
  }
}

export async function findWebhookEventByEventId(eventId: string): Promise<WebhookEvent | null> {
  const doc = await WebhookEventModel.findOne({ eventId }).lean().exec()
  return doc ? toWebhookEvent(doc) : null
}

export async function markWebhookProcessed(
  eventId: string,
  processedAt: Date,
): Promise<WebhookEvent | null> {
  const doc = await WebhookEventModel.findOneAndUpdate(
    { eventId },
    {
      $set: {
        status: WebhookEventStatus.PROCESSED,
        processedAt,
        error: null,
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  )
    .lean()
    .exec()
  return doc ? toWebhookEvent(doc) : null
}

export async function markWebhookFailed(
  eventId: string,
  errorMessage: string,
): Promise<WebhookEvent | null> {
  const doc = await WebhookEventModel.findOneAndUpdate(
    { eventId },
    {
      $set: {
        status: WebhookEventStatus.FAILED,
        error: errorMessage,
      },
      $inc: { attempts: 1 },
    },
    { new: true },
  )
    .lean()
    .exec()
  return doc ? toWebhookEvent(doc) : null
}
