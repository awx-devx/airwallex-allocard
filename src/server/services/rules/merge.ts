/**
 * Pipeline step 5 — merge desired state (RULES-ENGINE §4). Pure.
 *
 * Most restrictive wins, exactly per the spec's table:
 *
 * | field                             | merge                       |
 * | transactionLimits[interval].amount| min                         |
 * | allowedCurrencies / MCCs / countries / brands | intersection    |
 * | blockedTransactionUsages          | union                       |
 * | activeFrom                        | max                         |
 * | activeTo                          | min                         |
 * | cardStatus                        | CLOSED > INACTIVE > ACTIVE  |
 *
 * Two rules that cannot both be satisfied — an inverted active window, or an
 * empty allowlist intersection — produce a conflict and the field is **dropped**,
 * never pushed. An empty allowlist at Airwallex means "allow everything", so
 * pushing an empty intersection would invert its meaning; and a card that
 * silently declines everything is the worst outcome.
 *
 * Merge is commutative, so the result does not depend on rule order.
 */
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { MergeStrategy } from '@/shared/enums/mergeStrategy'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { BlockedTransactionUsage } from '@/shared/types/cardControls'
import type {
  DesiredCardState,
  DesiredState,
  MergeConflict,
  MergeExplanationEntry,
} from '@/shared/types/ruleRun'

export type ContributedLimit = {
  interval: TransactionLimitInterval
  amount: number
}

export type ContributedControls = {
  allowedTransactionCount?: AllowedTransactionCount
  transactionLimits?: { currency: string; limits: ContributedLimit[] }
  activeFrom?: string | null
  activeTo?: string | null
  allowedCurrencies?: string[] | null
  allowedMerchantCategories?: string[] | null
  allowedMerchantCountries?: string[] | null
  allowedMerchantBrands?: string[] | null
  blockedTransactionUsages?: BlockedTransactionUsage[]
}

export type CardContribution = {
  ruleId: string
  ruleName: string
  priority: number
  cardId: string
  controls?: ContributedControls
  cardStatus?: DesiredCardStatus
  /** True when this contribution's card.close carried allowDestructive. */
  allowDestructive?: boolean
}

export type MergeResult = {
  desiredState: DesiredState
  conflicts: MergeConflict[]
  explanations: MergeExplanationEntry[]
}

const STATUS_RESTRICTIVENESS: Record<DesiredCardStatus, number> = {
  [DesiredCardStatus.ACTIVE]: 0,
  [DesiredCardStatus.INACTIVE]: 1,
  [DesiredCardStatus.CLOSED]: 2,
}

type ContributionOf<T> = { contribution: CardContribution; value: T }

const ALLOWLIST_FIELDS = [
  'allowedCurrencies',
  'allowedMerchantCategories',
  'allowedMerchantCountries',
  'allowedMerchantBrands',
] as const

type AllowlistField = (typeof ALLOWLIST_FIELDS)[number]

const ALLOWLIST_CONFLICT: Record<AllowlistField, MergeConflict['kind']> = {
  allowedCurrencies: 'EMPTY_CURRENCY_INTERSECTION',
  allowedMerchantCategories: 'EMPTY_MCC_INTERSECTION',
  allowedMerchantCountries: 'EMPTY_COUNTRY_INTERSECTION',
  allowedMerchantBrands: 'EMPTY_BRAND_INTERSECTION',
}

function explain(
  field: string,
  strategy: MergeStrategy,
  entries: readonly ContributionOf<unknown>[],
  result: unknown,
): MergeExplanationEntry {
  return {
    field,
    strategy,
    // Sorted so an explanation reads the same however the rules arrived.
    contributions: entries
      .map((entry) => ({
        ruleId: entry.contribution.ruleId,
        ruleName: entry.contribution.ruleName,
        priority: entry.contribution.priority,
        value: entry.value,
      }))
      .sort((a, b) => a.priority - b.priority || a.ruleId.localeCompare(b.ruleId)),
    result,
  }
}

/**
 * `null`, absent, and `[]` all mean "this rule constrains nothing" — identical
 * to Airwallex. Only a non-empty list narrows the intersection.
 */
function constrainingAllowlists(
  contributions: readonly CardContribution[],
  field: AllowlistField,
): ContributionOf<string[]>[] {
  const out: ContributionOf<string[]>[] = []
  for (const contribution of contributions) {
    const value = contribution.controls?.[field]
    if (Array.isArray(value) && value.length > 0) {
      out.push({ contribution, value })
    }
  }
  return out
}

function intersect(lists: readonly string[][]): string[] {
  const [first, ...rest] = lists
  if (!first) {
    return []
  }
  return first.filter((entry) => rest.every((list) => list.includes(entry))).sort()
}

function mergeAllowlists(
  cardId: string,
  contributions: readonly CardContribution[],
  controls: Record<string, unknown>,
  conflicts: MergeConflict[],
  explanations: MergeExplanationEntry[],
): void {
  for (const field of ALLOWLIST_FIELDS) {
    const constraining = constrainingAllowlists(contributions, field)
    if (constraining.length === 0) {
      continue
    }

    const merged = intersect(constraining.map((entry) => entry.value))
    if (merged.length === 0) {
      conflicts.push({
        kind: ALLOWLIST_CONFLICT[field],
        message: `Rules produced an empty ${field} intersection for card ${cardId}; nothing pushed`,
        cardId,
        field,
      })
      explanations.push(explain(field, MergeStrategy.INTERSECT, constraining, null))
      continue
    }

    controls[field] = merged
    explanations.push(explain(field, MergeStrategy.INTERSECT, constraining, merged))
  }
}

function mergeLimits(
  cardId: string,
  contributions: readonly CardContribution[],
  controls: Record<string, unknown>,
  conflicts: MergeConflict[],
  explanations: MergeExplanationEntry[],
): void {
  const withLimits = contributions.filter((entry) => entry.controls?.transactionLimits)
  if (withLimits.length === 0) {
    return
  }

  const currencies = [
    ...new Set(withLimits.map((entry) => entry.controls!.transactionLimits!.currency)),
  ]
  if (currencies.length > 1) {
    conflicts.push({
      kind: 'OTHER',
      message: `Rules disagree on limit currency for card ${cardId} (${currencies.join(', ')}); nothing pushed`,
      cardId,
      field: 'transactionLimits',
    })
    return
  }

  const byInterval = new Map<TransactionLimitInterval, ContributionOf<number>[]>()
  for (const contribution of withLimits) {
    for (const limit of contribution.controls!.transactionLimits!.limits) {
      const entries = byInterval.get(limit.interval) ?? []
      entries.push({ contribution, value: limit.amount })
      byInterval.set(limit.interval, entries)
    }
  }

  const limits = [...byInterval.entries()]
    .map(([interval, entries]) => {
      const amount = Math.min(...entries.map((entry) => entry.value))
      explanations.push(
        explain(`transactionLimits.${interval}`, MergeStrategy.MIN, entries, amount),
      )
      return { interval, amount }
    })
    .sort((a, b) => a.interval.localeCompare(b.interval))

  controls.transactionLimits = { currency: currencies[0]!, limits }
}

function mergeWindow(
  cardId: string,
  contributions: readonly CardContribution[],
  controls: Record<string, unknown>,
  conflicts: MergeConflict[],
  explanations: MergeExplanationEntry[],
): void {
  const froms: ContributionOf<string>[] = []
  const tos: ContributionOf<string>[] = []
  for (const contribution of contributions) {
    const { activeFrom, activeTo } = contribution.controls ?? {}
    if (typeof activeFrom === 'string') {
      froms.push({ contribution, value: activeFrom })
    }
    if (typeof activeTo === 'string') {
      tos.push({ contribution, value: activeTo })
    }
  }

  const from =
    froms.length > 0
      ? froms.reduce((latest, entry) => (entry.value > latest.value ? entry : latest)).value
      : null
  const to =
    tos.length > 0
      ? tos.reduce((earliest, entry) => (entry.value < earliest.value ? entry : earliest)).value
      : null

  if (from !== null && to !== null && new Date(from).getTime() > new Date(to).getTime()) {
    conflicts.push({
      kind: 'ACTIVE_WINDOW_INVERTED',
      message: `Merged active window is inverted for card ${cardId} (${from} > ${to}); nothing pushed`,
      cardId,
      field: 'activeFrom',
    })
    explanations.push(explain('activeFrom', MergeStrategy.MAX, froms, null))
    explanations.push(explain('activeTo', MergeStrategy.MIN, tos, null))
    return
  }

  if (from !== null) {
    controls.activeFrom = from
    explanations.push(explain('activeFrom', MergeStrategy.MAX, froms, from))
  }
  if (to !== null) {
    controls.activeTo = to
    explanations.push(explain('activeTo', MergeStrategy.MIN, tos, to))
  }
}

function mergeBlockedUsages(
  contributions: readonly CardContribution[],
  controls: Record<string, unknown>,
  explanations: MergeExplanationEntry[],
): void {
  const entries: ContributionOf<BlockedTransactionUsage[]>[] = []
  const union = new Map<string, BlockedTransactionUsage>()

  for (const contribution of contributions) {
    const usages = contribution.controls?.blockedTransactionUsages
    if (!usages || usages.length === 0) {
      continue
    }
    entries.push({ contribution, value: usages })
    for (const usage of usages) {
      union.set(`${usage.transactionScope}|${usage.usageScope}`, usage)
    }
  }

  if (entries.length === 0) {
    return
  }

  const merged = [...union.values()].sort((a, b) =>
    `${a.transactionScope}|${a.usageScope}`.localeCompare(`${b.transactionScope}|${b.usageScope}`),
  )
  controls.blockedTransactionUsages = merged
  explanations.push(explain('blockedTransactionUsages', MergeStrategy.UNION, entries, merged))
}

function mergeTransactionCount(
  contributions: readonly CardContribution[],
  controls: Record<string, unknown>,
  explanations: MergeExplanationEntry[],
): void {
  const entries: ContributionOf<AllowedTransactionCount>[] = []
  for (const contribution of contributions) {
    const value = contribution.controls?.allowedTransactionCount
    if (value !== undefined) {
      entries.push({ contribution, value })
    }
  }
  if (entries.length === 0) {
    return
  }

  const merged = entries.some((entry) => entry.value === AllowedTransactionCount.SINGLE)
    ? AllowedTransactionCount.SINGLE
    : AllowedTransactionCount.MULTIPLE
  controls.allowedTransactionCount = merged
  explanations.push(
    explain('allowedTransactionCount', MergeStrategy.MOST_RESTRICTIVE, entries, merged),
  )
}

function mergeStatus(
  contributions: readonly CardContribution[],
  explanations: MergeExplanationEntry[],
): DesiredCardStatus | undefined {
  const entries: ContributionOf<DesiredCardStatus>[] = []
  for (const contribution of contributions) {
    if (contribution.cardStatus !== undefined) {
      entries.push({ contribution, value: contribution.cardStatus })
    }
  }
  if (entries.length === 0) {
    return undefined
  }

  const merged = entries.reduce((most, entry) =>
    STATUS_RESTRICTIVENESS[entry.value] > STATUS_RESTRICTIVENESS[most.value] ? entry : most,
  ).value
  explanations.push(explain('cardStatus', MergeStrategy.MOST_RESTRICTIVE, entries, merged))
  return merged
}

/** Merge every rule's contributions into one desired state per card. */
export function mergeContributions(contributions: readonly CardContribution[]): MergeResult {
  const byCard = new Map<string, CardContribution[]>()
  for (const contribution of contributions) {
    const entries = byCard.get(contribution.cardId) ?? []
    entries.push(contribution)
    byCard.set(contribution.cardId, entries)
  }

  const conflicts: MergeConflict[] = []
  const explanations: MergeExplanationEntry[] = []
  const cards: DesiredCardState[] = []

  for (const cardId of [...byCard.keys()].sort()) {
    const forCard = byCard.get(cardId)!
    const controls: Record<string, unknown> = {}

    mergeLimits(cardId, forCard, controls, conflicts, explanations)
    mergeAllowlists(cardId, forCard, controls, conflicts, explanations)
    mergeWindow(cardId, forCard, controls, conflicts, explanations)
    mergeBlockedUsages(forCard, controls, explanations)
    mergeTransactionCount(forCard, controls, explanations)
    const cardStatus = mergeStatus(forCard, explanations)

    const state: DesiredCardState = { cardId }
    if (Object.keys(controls).length > 0) {
      state.controls = controls as DesiredCardState['controls']
    }
    if (cardStatus !== undefined) {
      state.cardStatus = cardStatus
      if (cardStatus === DesiredCardStatus.CLOSED) {
        // Close only when at least one CLOSED contribution opted in.
        state.allowDestructiveClose = forCard.some(
          (c) => c.cardStatus === DesiredCardStatus.CLOSED && c.allowDestructive === true,
        )
      }
    }
    cards.push(state)
  }

  return { desiredState: { cards }, conflicts, explanations }
}
