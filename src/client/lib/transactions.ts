/**
 * A8 activity & transaction screen helpers. Pure — no React.
 *
 * Ledger mapping is server-side. This file does not import or reimplement
 * `ledgerMap` / receipt sweep. Amounts stay integer minor units.
 */
import { cardHref, closedCardMessage, flattenTransactionPages } from '@/client/lib/cards'
import { cardExplainHref } from '@/client/lib/rules'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { isoDateSchema } from '@/shared/schemas/base'

export { cardExplainHref, cardHref, closedCardMessage, flattenTransactionPages }

export const RECEIPT_THRESHOLD_MINOR = 5000
export const RECEIPT_MAX_BASE64_CHARS = 10 * 1024 * 1024
export const RECEIPT_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number]

export type TransactionListSearch = {
  projectId?: string
  cardId?: string
  status?: TransactionStatus
  from?: string
  to?: string
}

export type DeclinedListSearch = {
  projectId?: string
  cardId?: string
  from?: string
  to?: string
}

export type ReceiptsListSearch = {
  projectId?: string
  from?: string
  to?: string
}

export type EmptyCopy = { title: string; description: string }

const VIEW_DENIED = "You don't have permission to view transactions."
const TX_NOT_FOUND = 'This transaction is not available.'
const PENDING_AUTH = 'Authorized — not yet cleared.'
const AUTH_CLEARING_DIFFER = 'Cleared amount differs from the authorization.'
const PARTIAL_CLEARING = 'Partial clearing — remainder may still be committed.'
const REVERSAL = 'This transaction was reversed or refunded.'
const DECLINE_FALLBACK = 'No reason recorded.'
const BILLED_AS = 'Billed as'
const WHY_THIS_LIMIT = 'Why this limit?'
const LIFECYCLE = 'Lifecycle'
const RECEIPT_ATTACHED = 'Receipt attached.'
const RECEIPT_REQUIRED = 'Receipt required.'
const RECEIPT_NOT_REQUIRED = 'No receipt required.'
const BAD_RECEIPT_TYPE = 'Use a PDF or image (JPEG, PNG, or WebP).'
const RECEIPT_TOO_LARGE = 'File too large (max 10MB).'
const RECEIPTS_LOAD_MORE = 'Load more to check older cleared transactions.'
const OPTIMISTIC_RECEIPT_ID = 'optimistic-receipt'

const TX_STATUS_VALUES = new Set<string>(Object.values(TransactionStatus))
const RECEIPT_TYPE_SET = new Set<string>(RECEIPT_CONTENT_TYPES)

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

function humaniseEnum(value: string): string {
  const lower = value.split('_').join(' ').toLowerCase()
  if (lower.length === 0) {
    return value
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function activityHref(): string {
  return '/activity'
}

export function projectActivityHref(projectId: string): string {
  return `/projects/${requireId(projectId, 'projectId')}/activity`
}

export function transactionsHref(): string {
  return '/transactions'
}

export function transactionHref(transactionId: string): string {
  return `/transactions/${requireId(transactionId, 'transactionId')}`
}

export function declinedHref(): string {
  return '/transactions/declined'
}

export function receiptsHref(): string {
  return '/receipts'
}

export function parseOptionalIdParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined || value.length < 1) {
    return undefined
  }
  return value
}

export function parseIsoQueryParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined) {
    return undefined
  }
  const parsed = isoDateSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

export function parseTxStatusParam(
  input: string | string[] | undefined,
): TransactionStatus | undefined {
  const value = firstParam(input)
  if (value === undefined || !TX_STATUS_VALUES.has(value)) {
    return undefined
  }
  return value as TransactionStatus
}

export function parseTransactionListSearchParams(input: {
  projectId?: string | string[]
  cardId?: string | string[]
  status?: string | string[]
  from?: string | string[]
  to?: string | string[]
}): TransactionListSearch {
  const result: TransactionListSearch = {}
  const projectId = parseOptionalIdParam(input.projectId)
  const cardId = parseOptionalIdParam(input.cardId)
  const status = parseTxStatusParam(input.status)
  const from = parseIsoQueryParam(input.from)
  const to = parseIsoQueryParam(input.to)
  if (projectId !== undefined) result.projectId = projectId
  if (cardId !== undefined) result.cardId = cardId
  if (status !== undefined) result.status = status
  if (from !== undefined) result.from = from
  if (to !== undefined) result.to = to
  return result
}

export function transactionListHref(filter: {
  projectId?: string
  cardId?: string
  status?: string
  from?: string
  to?: string
}): string {
  return appendQuery('/transactions', [
    [
      'projectId',
      filter.projectId !== undefined && filter.projectId.length >= 1 ? filter.projectId : undefined,
    ],
    [
      'cardId',
      filter.cardId !== undefined && filter.cardId.length >= 1 ? filter.cardId : undefined,
    ],
    [
      'status',
      filter.status !== undefined && filter.status.length >= 1 ? filter.status : undefined,
    ],
    ['from', filter.from !== undefined && filter.from.length >= 1 ? filter.from : undefined],
    ['to', filter.to !== undefined && filter.to.length >= 1 ? filter.to : undefined],
  ])
}

export function parseDeclinedSearchParams(input: {
  projectId?: string | string[]
  cardId?: string | string[]
  from?: string | string[]
  to?: string | string[]
}): DeclinedListSearch {
  const result: DeclinedListSearch = {}
  const projectId = parseOptionalIdParam(input.projectId)
  const cardId = parseOptionalIdParam(input.cardId)
  const from = parseIsoQueryParam(input.from)
  const to = parseIsoQueryParam(input.to)
  if (projectId !== undefined) result.projectId = projectId
  if (cardId !== undefined) result.cardId = cardId
  if (from !== undefined) result.from = from
  if (to !== undefined) result.to = to
  return result
}

export function declinedListHref(filter: {
  projectId?: string
  cardId?: string
  from?: string
  to?: string
}): string {
  return appendQuery('/transactions/declined', [
    [
      'projectId',
      filter.projectId !== undefined && filter.projectId.length >= 1 ? filter.projectId : undefined,
    ],
    [
      'cardId',
      filter.cardId !== undefined && filter.cardId.length >= 1 ? filter.cardId : undefined,
    ],
    ['from', filter.from !== undefined && filter.from.length >= 1 ? filter.from : undefined],
    ['to', filter.to !== undefined && filter.to.length >= 1 ? filter.to : undefined],
  ])
}

export function parseReceiptsSearchParams(input: {
  projectId?: string | string[]
  from?: string | string[]
  to?: string | string[]
}): ReceiptsListSearch {
  const result: ReceiptsListSearch = {}
  const projectId = parseOptionalIdParam(input.projectId)
  const from = parseIsoQueryParam(input.from)
  const to = parseIsoQueryParam(input.to)
  if (projectId !== undefined) result.projectId = projectId
  if (from !== undefined) result.from = from
  if (to !== undefined) result.to = to
  return result
}

export function receiptsListHref(filter: {
  projectId?: string
  from?: string
  to?: string
}): string {
  return appendQuery('/receipts', [
    [
      'projectId',
      filter.projectId !== undefined && filter.projectId.length >= 1 ? filter.projectId : undefined,
    ],
    ['from', filter.from !== undefined && filter.from.length >= 1 ? filter.from : undefined],
    ['to', filter.to !== undefined && filter.to.length >= 1 ? filter.to : undefined],
  ])
}

export function holdsTransactionView(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  if (orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN) {
    return true
  }
  return Boolean(projects?.some((row) => row.permissions.includes(Permission.TRANSACTION_VIEW)))
}

export function requiresProjectIdOnTxList(orgRole: string | undefined): boolean {
  return orgRole !== OrgRole.OWNER && orgRole !== OrgRole.ADMIN
}

export function billingDiffers(currency: string, billingCurrency: string): boolean {
  return currency.length === 3 && billingCurrency.length === 3 && currency !== billingCurrency
}

export function needsReceipt(row: {
  status: string
  receiptFileId: string | null
  amount: number
}): boolean {
  return (
    row.status === TransactionStatus.CLEARED &&
    row.receiptFileId === null &&
    row.amount >= RECEIPT_THRESHOLD_MINOR
  )
}

export function receiptLabel(row: {
  status: string
  receiptFileId: string | null
  amount: number
}): string {
  if (row.receiptFileId !== null && row.receiptFileId.length >= 1) {
    return RECEIPT_ATTACHED
  }
  if (needsReceipt(row)) {
    return RECEIPT_REQUIRED
  }
  return RECEIPT_NOT_REQUIRED
}

export function declineReason(failureReason: string | null): string {
  if (failureReason !== null && failureReason.length >= 1) {
    return failureReason
  }
  return DECLINE_FALLBACK
}

export function isPendingAuthorization(
  status: string,
  types: ReadonlyArray<{ type: string }>,
): boolean {
  if (status !== TransactionStatus.AUTHORIZED) {
    return false
  }
  return !types.some(
    (event) =>
      event.type === TransactionType.CLEARING || event.type === TransactionType.PARTIAL_CLEARING,
  )
}

export function isReversalType(type: string): boolean {
  return (
    type === TransactionType.REVERSAL_AUTH ||
    type === TransactionType.PARTIAL_REVERSAL ||
    type === TransactionType.CLEARING_REVERSAL
  )
}

export function lifecycleSorted<T extends { transactedAt: string; id: string }>(
  events: readonly T[],
): T[] {
  return [...events].sort((a, b) => {
    if (a.transactedAt !== b.transactedAt) {
      return a.transactedAt < b.transactedAt ? -1 : 1
    }
    if (a.id !== b.id) {
      return a.id < b.id ? -1 : 1
    }
    return 0
  })
}

export function authorizationAmount(
  events: ReadonlyArray<{ type: string; amount: number }>,
): number | null {
  let last: number | null = null
  for (const event of events) {
    if (
      event.type === TransactionType.AUTHORIZATION ||
      event.type === TransactionType.INCREMENTAL_AUTHORIZATION
    ) {
      last = event.amount
    }
  }
  return last
}

export function clearingAmount(
  events: ReadonlyArray<{ type: string; amount: number }>,
): number | null {
  let last: number | null = null
  for (const event of events) {
    if (
      event.type === TransactionType.CLEARING ||
      event.type === TransactionType.PARTIAL_CLEARING
    ) {
      last = event.amount
    }
  }
  return last
}

export function authClearingDiffer(
  events: ReadonlyArray<{ type: string; amount: number }>,
): boolean {
  const authorized = authorizationAmount(events)
  const cleared = clearingAmount(events)
  return authorized !== null && cleared !== null && authorized !== cleared
}

export function transactionStatusLabel(status: string): string {
  return humaniseEnum(status)
}

export function transactionTypeLabel(type: string): string {
  return humaniseEnum(type)
}

export function receiptContentType(mime: string): ReceiptContentType | null {
  const normalised = mime === 'image/jpg' ? 'image/jpeg' : mime
  if (RECEIPT_TYPE_SET.has(normalised)) {
    return normalised as ReceiptContentType
  }
  return null
}

export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) {
    return dataUrl
  }
  return dataUrl.slice(comma + 1)
}

export function isOptimisticReceiptId(id: string | null): boolean {
  return id === OPTIMISTIC_RECEIPT_ID
}

export function viewTransactionsDenialMessage(): string {
  return VIEW_DENIED
}

export function transactionNotFoundMessage(): string {
  return TX_NOT_FOUND
}

export function pendingAuthMessage(): string {
  return PENDING_AUTH
}

export function authClearingDifferMessage(): string {
  return AUTH_CLEARING_DIFFER
}

export function partialClearingMessage(): string {
  return PARTIAL_CLEARING
}

export function reversalMessage(): string {
  return REVERSAL
}

export function billedAsLabel(): string {
  return BILLED_AS
}

export function whyThisLimitLink(): string {
  return WHY_THIS_LIMIT
}

export function lifecycleHeading(): string {
  return LIFECYCLE
}

export function badReceiptTypeMessage(): string {
  return BAD_RECEIPT_TYPE
}

export function receiptTooLargeMessage(): string {
  return RECEIPT_TOO_LARGE
}

export function receiptsLoadMoreHint(): string {
  return RECEIPTS_LOAD_MORE
}

export function selectProjectEmpty(): EmptyCopy {
  return {
    title: 'Select a project',
    description: 'Transactions are listed per project.',
  }
}

export function noTransactionsEmpty(): EmptyCopy {
  return {
    title: 'No transactions yet',
    description: 'When a card is used, activity appears here.',
  }
}

export function noDeclinedEmpty(): EmptyCopy {
  return {
    title: 'No declined transactions',
    description: 'A decline is a policy working or a misconfiguration.',
  }
}

export function noActivityEmpty(): EmptyCopy {
  return {
    title: 'No activity yet',
    description: 'Transactions, requests, cards, and rule runs land here.',
  }
}

export function noProjectActivityEmpty(): EmptyCopy {
  return {
    title: 'No activity yet',
    description: 'This project has no feed items yet.',
  }
}

export function noReceiptsEmpty(): EmptyCopy {
  return {
    title: 'No missing receipts',
    description: 'Cleared spend over the threshold needs a receipt.',
  }
}
