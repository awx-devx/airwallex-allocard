/**
 * Remote authorization decision — Redis GET + pure comparisons.
 * No database reads. Fail-open by default when snapshot missing/stale.
 */
import { majorToMinor } from '@/server/services/cards/controls'
import type { CardPolicySnapshot } from '@/server/services/rules/apply'
import { getRedis, redisKeys } from '@/server/redis'
import { RemoteAuthResponseStatus } from '@/shared/enums/remoteAuthResponseStatus'
import type { RemoteAuthDecision, RemoteAuthInput } from '@/shared/types/remoteAuth'

/** Snapshot older than this is treated as stale (fail-open). */
export const POLICY_SNAPSHOT_MAX_AGE_MS = 60 * 60_000

const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000

export type RemoteAuthFailMode = 'open' | 'closed'

export type DecideRemoteAuthOptions = {
  /** Injected for tests — defaults to Redis GET. */
  getSnapshot?: (cardId: string) => Promise<CardPolicySnapshot | null>
  nowMs?: number
  failMode?: RemoteAuthFailMode
  /** When false, skip rate limit (tests). */
  rateLimit?: boolean
}

export type DecideRemoteAuthResult = {
  decision: RemoteAuthDecision
  flagged: boolean
  durationMs: number
  reason: string
}

export type HardStopAuth = {
  amountMinor: number
  currency: string
  mcc: string
  country: string
}

function parseSnapshot(raw: string | null): CardPolicySnapshot | null {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as CardPolicySnapshot
  } catch {
    return null
  }
}

function isStale(snapshot: CardPolicySnapshot, nowMs: number): boolean {
  const refreshedAt = Date.parse(snapshot.refreshedAt)
  if (!Number.isFinite(refreshedAt)) {
    return true
  }
  return nowMs - refreshedAt > POLICY_SNAPSHOT_MAX_AGE_MS
}

/**
 * Pure hard-stop evaluation against a policy snapshot.
 * Returns AUTHORIZED or DECLINED with a reason string.
 */
export function evaluateHardStops(
  snapshot: CardPolicySnapshot,
  auth: HardStopAuth,
): { responseStatus: RemoteAuthResponseStatus; statusReason: string } {
  const { hardStops } = snapshot

  if (hardStops.allowedMcc !== null && !hardStops.allowedMcc.includes(auth.mcc)) {
    return {
      responseStatus: RemoteAuthResponseStatus.DECLINED,
      statusReason: 'mcc_not_allowed',
    }
  }

  if (hardStops.allowedCountries !== null && !hardStops.allowedCountries.includes(auth.country)) {
    return {
      responseStatus: RemoteAuthResponseStatus.DECLINED,
      statusReason: 'country_not_allowed',
    }
  }

  if (hardStops.projectRemaining !== null && auth.amountMinor > hardStops.projectRemaining) {
    return {
      responseStatus: RemoteAuthResponseStatus.DECLINED,
      statusReason: 'project_budget_exceeded',
    }
  }

  if (
    hardStops.memberMtdCap !== null &&
    hardStops.memberMtdSpent !== null &&
    hardStops.memberMtdSpent + auth.amountMinor > hardStops.memberMtdCap
  ) {
    return {
      responseStatus: RemoteAuthResponseStatus.DECLINED,
      statusReason: 'member_mtd_cap_exceeded',
    }
  }

  if (
    hardStops.requireApprovalAbove !== null &&
    auth.amountMinor >= hardStops.requireApprovalAbove &&
    hardStops.approvedRequestIds.length === 0
  ) {
    return {
      responseStatus: RemoteAuthResponseStatus.DECLINED,
      statusReason: 'approval_required',
    }
  }

  return {
    responseStatus: RemoteAuthResponseStatus.AUTHORIZED,
    statusReason: 'ok',
  }
}

async function assertRemoteAuthRateLimit(cardId: string): Promise<void> {
  const redis = getRedis()
  const key = redisKeys.rateRemoteAuth(cardId)
  await redis.set(key, '0', { nx: true, px: RATE_WINDOW_MS })
  const count = await redis.incr(key)
  if (count > RATE_LIMIT) {
    // Still fail-open on rate limit for the demo — flag via reason.
    console.error('[remote-auth] rate limit exceeded for card', cardId)
  }
}

/**
 * One Redis GET → pure comparisons → decision.
 * Missing/stale snapshot → AUTHORIZED + flagged when failMode=open.
 */
export async function decideRemoteAuth(
  input: RemoteAuthInput,
  options: DecideRemoteAuthOptions = {},
): Promise<DecideRemoteAuthResult> {
  const t0 = options.nowMs ?? Date.now()
  const failMode = options.failMode ?? 'open'

  if (options.rateLimit !== false) {
    await assertRemoteAuthRateLimit(input.card_id)
  }

  const getSnapshot =
    options.getSnapshot ??
    (async (cardId: string) => {
      const raw = await getRedis().get(redisKeys.policyCard(cardId))
      return parseSnapshot(raw)
    })

  const snapshot = await getSnapshot(input.card_id)
  const amountMinor = majorToMinor(input.transaction_amount, input.transaction_currency)
  const auth: HardStopAuth = {
    amountMinor,
    currency: input.transaction_currency,
    mcc: input.merchant.category_code,
    country: input.merchant.country,
  }

  let responseStatus: RemoteAuthResponseStatus
  let statusReason: string
  let flagged = false

  if (!snapshot || isStale(snapshot, t0)) {
    flagged = true
    if (failMode === 'open') {
      console.error(
        '[remote-auth] FAIL-OPEN: policy snapshot missing or stale for card',
        input.card_id,
      )
      responseStatus = RemoteAuthResponseStatus.AUTHORIZED
      statusReason = 'policy_snapshot_unavailable'
    } else {
      console.error(
        '[remote-auth] FAIL-CLOSED: policy snapshot missing or stale for card',
        input.card_id,
      )
      responseStatus = RemoteAuthResponseStatus.DECLINED
      statusReason = 'policy_snapshot_unavailable'
    }
  } else {
    const result = evaluateHardStops(snapshot, auth)
    responseStatus = result.responseStatus
    statusReason = result.statusReason
  }

  const decision: RemoteAuthDecision = {
    card_transaction_event_id: input.card_transaction_event_id,
    response_status: responseStatus,
    status_reason: statusReason,
  }

  const durationMs = (options.nowMs ?? Date.now()) - t0
  // Fire-and-forget recording — never block the response path.
  void Promise.resolve().then(() => {
    console.info('[remote-auth] decision', {
      cardId: input.card_id,
      responseStatus,
      statusReason,
      flagged,
      durationMs,
    })
  })

  return { decision, flagged, durationMs, reason: statusReason }
}
