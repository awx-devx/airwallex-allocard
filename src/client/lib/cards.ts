/**
 * PCI boundary: never a PAN.
 *
 * A5 card screen helpers. Pure — no React.
 * Remaining limits come from `useCardLimits`; this file does not compute spend.
 */
import { cardsTabHref } from '@/client/lib/budget'
import type { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { listCardsQuery, listProjectCardsQuery } from '@/shared/schemas/card'
import type { ListCardsQuery, ListProjectCardsQuery } from '@/shared/types/card'

const MANAGE_DENIED = "You don't have permission to manage this card."
const REVEAL_DENIED = "You don't have permission to reveal card details. Reveals are audited."
const REVEAL_AUDITED = 'Revealing card details is audited.'
const PENDING_CREATE = 'This card is still being created.'
const CARDHOLDER_SCREENING =
  'The cardholder is still screening. The card issues when the cardholder is READY.'
const FAILED_CREATE = 'Card creation failed.'
const FROZEN = 'This card is frozen.'
const CLOSED = 'This card is closed. It is kept for transaction history.'
const SINGLE_USE_USED = 'This single-use card has been used.'
const IFRAME_PENDING = 'Card details are not available until the card is issued.'
const IFRAME_ERROR = 'The secure card frame failed to load.'

export const AIRWALLEX_PCI_IFRAME_ORIGIN = 'https://airwallex.com'

export const AIRWALLEX_PCI_MESSAGE_ORIGINS: ReadonlySet<string> = new Set([
  'https://airwallex.com',
  'https://www.airwallex.com',
])

export const AIRWALLEX_PCI_CSS_CLASSES = {
  cardNumberRow: 'details__row--card-number',
  value: 'details__value',
} as const satisfies Readonly<{
  cardNumberRow: 'details__row--card-number'
  value: 'details__value'
}>

export const CLOSE_CONFIRM_PHRASE = 'CLOSE'

export type ControlsDiffInput = {
  allowedTransactionCount: string
  transactionLimits: { currency: string; limits: { interval: string; amount: number }[] }
  activeFrom: string | null
  activeTo: string | null
  allowedCurrencies: string[] | null
  allowedMerchantCategories: string[] | null
  allowedMerchantCountries: string[] | null
  allowedMerchantBrands: string[] | null
  blockedTransactionUsages: unknown
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function requireId(id: string, name: string): string {
  if (id.length < 1) {
    throw new Error(`${name} is required`)
  }
  return id
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function appendQuery(
  path: string,
  entries: ReadonlyArray<readonly [string, string | undefined]>,
): string {
  const params = new URLSearchParams()
  for (const [key, value] of entries) {
    if (value !== undefined) {
      params.set(key, value)
    }
  }
  const qs = params.toString()
  return qs.length > 0 ? `${path}?${qs}` : path
}

export function orgCardsHref(): string {
  return '/cards'
}

export function cardHref(cardId: string): string {
  return `/cards/${requireId(cardId, 'cardId')}`
}

export function cardRevealHref(cardId: string): string {
  return `/cards/${requireId(cardId, 'cardId')}/reveal`
}

export function projectCardsHref(projectId: string): string {
  return cardsTabHref(projectId)
}

export function controlsHref(projectId: string): string {
  return `/projects/${requireId(projectId, 'projectId')}/controls`
}

export function ruleHref(projectId: string, ruleId: string): string {
  return `${controlsHref(projectId)}?ruleId=${encodeURIComponent(requireId(ruleId, 'ruleId'))}`
}

export function parseCardListSearchParams(input: {
  projectId?: string | string[]
  status?: string | string[]
  purpose?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
}): ListCardsQuery {
  const raw: Record<string, string> = {}
  const projectId = firstParam(input.projectId)
  const status = firstParam(input.status)
  const purpose = firstParam(input.purpose)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  if (projectId !== undefined) raw.projectId = projectId
  if (status !== undefined) raw.status = status
  if (purpose !== undefined) raw.purpose = purpose
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listCardsQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 }
  }
  return parsed.data
}

export function cardListHref(filter: {
  projectId?: string
  status?: CardStatus
  purpose?: CardPurpose
  page?: number
  pageSize?: number
}): string {
  return appendQuery('/cards', [
    ['projectId', filter.projectId],
    ['status', filter.status],
    ['purpose', filter.purpose],
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function parseProjectCardListSearchParams(input: {
  status?: string | string[]
  purpose?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
}): ListProjectCardsQuery {
  const raw: Record<string, string> = {}
  const status = firstParam(input.status)
  const purpose = firstParam(input.purpose)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  if (status !== undefined) raw.status = status
  if (purpose !== undefined) raw.purpose = purpose
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listProjectCardsQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 }
  }
  return parsed.data
}

export function projectCardListHref(
  projectId: string,
  filter: {
    status?: CardStatus
    purpose?: CardPurpose
    page?: number
    pageSize?: number
  },
): string {
  return appendQuery(projectCardsHref(projectId), [
    ['status', filter.status],
    ['purpose', filter.purpose],
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function isPendingCreate(status: string): boolean {
  return status === CardStatus.PENDING
}

export function isPendingAirwallexId(airwallexCardId: string): boolean {
  return airwallexCardId.startsWith('pending:')
}

export function isFrozen(status: string): boolean {
  return status === CardStatus.INACTIVE
}

export function isClosed(status: string): boolean {
  return status === CardStatus.CLOSED
}

export function isFailed(status: string): boolean {
  return status === CardStatus.FAILED
}

export function isTerminalLost(status: string): boolean {
  return status === CardStatus.BLOCKED || status === CardStatus.LOST || status === CardStatus.STOLEN
}

export function canRevealCard(status: string, airwallexCardId: string): boolean {
  return (
    (status === CardStatus.ACTIVE || status === CardStatus.INACTIVE) &&
    !isPendingAirwallexId(airwallexCardId)
  )
}

export function canFreezeCard(status: string): boolean {
  return status === CardStatus.ACTIVE
}

export function canUnfreezeCard(status: string): boolean {
  return status === CardStatus.INACTIVE
}

export function canCloseCard(status: string): boolean {
  return status === CardStatus.ACTIVE || status === CardStatus.INACTIVE
}

export function canEditCardMeta(status: string): boolean {
  return status === CardStatus.ACTIVE || status === CardStatus.INACTIVE
}

export function isScreeningCardholder(status: string): boolean {
  return status === 'PENDING' || status === 'INCOMPLETE'
}

export function isSingleUse(allowedTransactionCount: string): boolean {
  return allowedTransactionCount === 'SINGLE'
}

export function isSingleUseUsed(input: {
  allowedTransactionCount: string
  status: string
  transactionCount: number
}): boolean {
  return (
    isSingleUse(input.allowedTransactionCount) &&
    (isClosed(input.status) || input.transactionCount > 0)
  )
}

export function controlsDiverge(desired: unknown, applied: unknown): boolean {
  return JSON.stringify(desired) !== JSON.stringify(applied)
}

export function controlsToDiffView(
  applied: ControlsDiffInput,
  desired: ControlsDiffInput,
): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const before: Record<string, unknown> = {
    allowedTransactionCount: applied.allowedTransactionCount,
    activeFrom: applied.activeFrom,
    activeTo: applied.activeTo,
    allowedCurrencies: applied.allowedCurrencies,
    allowedMerchantCategories: applied.allowedMerchantCategories,
    allowedMerchantCountries: applied.allowedMerchantCountries,
    allowedMerchantBrands: applied.allowedMerchantBrands,
    blockedTransactionUsages: applied.blockedTransactionUsages,
  }
  const after: Record<string, unknown> = {
    allowedTransactionCount: desired.allowedTransactionCount,
    activeFrom: desired.activeFrom,
    activeTo: desired.activeTo,
    allowedCurrencies: desired.allowedCurrencies,
    allowedMerchantCategories: desired.allowedMerchantCategories,
    allowedMerchantCountries: desired.allowedMerchantCountries,
    allowedMerchantBrands: desired.allowedMerchantBrands,
    blockedTransactionUsages: desired.blockedTransactionUsages,
  }

  const appliedByInterval = new Map(
    applied.transactionLimits.limits.map((row) => [row.interval, row.amount]),
  )
  const desiredByInterval = new Map(
    desired.transactionLimits.limits.map((row) => [row.interval, row.amount]),
  )
  const intervals: string[] = []
  for (const row of applied.transactionLimits.limits) {
    if (!intervals.includes(row.interval)) intervals.push(row.interval)
  }
  for (const row of desired.transactionLimits.limits) {
    if (!intervals.includes(row.interval)) intervals.push(row.interval)
  }
  for (const interval of intervals) {
    const key = `limit.${interval}`
    const appliedAmount = appliedByInterval.get(interval)
    const desiredAmount = desiredByInterval.get(interval)
    before[key] =
      appliedAmount === undefined
        ? undefined
        : { amount: appliedAmount, currency: applied.transactionLimits.currency }
    after[key] =
      desiredAmount === undefined
        ? undefined
        : { amount: desiredAmount, currency: desired.transactionLimits.currency }
  }

  return { before, after }
}

export function airwallexRevealIframeSrc(airwallexCardId: string, token: string): string {
  if (airwallexCardId.length < 1 || token.length < 1) {
    throw new Error('airwallexCardId and token are required')
  }
  return `${AIRWALLEX_PCI_IFRAME_ORIGIN}/issuing/pci/v2/${airwallexCardId}/details#${token}`
}

export function isAirwallexPciOrigin(origin: string): boolean {
  return AIRWALLEX_PCI_MESSAGE_ORIGINS.has(origin)
}

export function classifyRevealMessage(data: unknown): 'error' | 'ready' | 'ignore' {
  if (!isPlainObject(data) || typeof data.type !== 'string') {
    return 'ignore'
  }
  return /error/i.test(data.type) ? 'error' : 'ready'
}

export function holderLabel(
  cardholder: { type: string; status: string; userId: string | null },
  userName: string | undefined,
): string {
  if (userName !== undefined && userName.length >= 1) {
    return userName
  }
  if (cardholder.userId !== null && cardholder.userId.length >= 1) {
    return cardholder.userId
  }
  return `${cardholder.type} ${cardholder.status}`
}

export function memberNameByUserId(
  userId: string | null,
  members: ReadonlyArray<{ userId?: string; user?: { id: string; name: string } }>,
): string | undefined {
  if (userId === null || userId.length < 1) {
    return undefined
  }
  const name = members.find((row) => row.userId === userId || row.user?.id === userId)?.user?.name
  return name !== undefined && name.length >= 1 ? name : undefined
}

export function accessListNames(
  accessList: string[],
  members: ReadonlyArray<{ userId?: string; user?: { id: string; name: string } }>,
): { userId: string; name: string }[] {
  return accessList.map((userId) => {
    const member = members.find((row) => row.userId === userId || row.user?.id === userId)
    const name = member?.user?.name
    return { userId, name: name !== undefined && name.length >= 1 ? name : userId }
  })
}

export function flattenTransactionPages(
  pages: ReadonlyArray<{ items: readonly unknown[] }> | undefined,
): unknown[] {
  return pages?.flatMap((page) => page.items) ?? []
}

export function cardLimitsToMeters(output: {
  currency: string
  limits: { interval: string; amount: number; remaining: number }[]
}): { interval: string; amount: number; remaining: number; currency: string }[] {
  return output.limits.map((row) => ({
    interval: row.interval,
    amount: row.amount,
    remaining: row.remaining,
    currency: output.currency,
  }))
}

export function manageCardDenialMessage(): string {
  return MANAGE_DENIED
}

export function revealCardDenialMessage(): string {
  return REVEAL_DENIED
}

export function revealAuditedMessage(): string {
  return REVEAL_AUDITED
}

export function pendingCreateMessage(): string {
  return PENDING_CREATE
}

export function cardholderScreeningMessage(): string {
  return CARDHOLDER_SCREENING
}

export function failedCreateMessage(): string {
  return FAILED_CREATE
}

export function frozenCardMessage(): string {
  return FROZEN
}

export function closedCardMessage(): string {
  return CLOSED
}

export function singleUseUsedMessage(): string {
  return SINGLE_USE_USED
}

export function iframePendingMessage(): string {
  return IFRAME_PENDING
}

export function iframeErrorMessage(): string {
  return IFRAME_ERROR
}

export function lostCardMessage(status: 'BLOCKED' | 'LOST' | 'STOLEN'): string {
  return `This card is ${status}.`
}

export function tokenIsExpired(expiresAt: string, nowMs: number): boolean {
  const parsed = Date.parse(expiresAt)
  if (Number.isNaN(parsed)) {
    return true
  }
  return parsed <= nowMs
}

export type PanTokenDecision = { kind: 'ok'; token: string } | { kind: 'retry' } | { kind: 'fail' }

/** Valid token → use it. Expired once → retry. Else fail (do not hang on LoadingState). */
export function classifyPanTokenResult(
  data: { token: string; expiresAt: string },
  nowMs: number,
  alreadyRetried: boolean,
): PanTokenDecision {
  if (!tokenIsExpired(data.expiresAt, nowMs) && data.token.length >= 1) {
    return { kind: 'ok', token: data.token }
  }
  if (tokenIsExpired(data.expiresAt, nowMs) && !alreadyRetried) {
    return { kind: 'retry' }
  }
  return { kind: 'fail' }
}
