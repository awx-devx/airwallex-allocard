/**
 * A4 budget screen helpers. Pure — no React.
 *
 * Formula evaluation is server-side (`useValidateFormula`). This file only
 * tokenizes, diffs card desired-limits, and formats locked copy.
 */
import type { BudgetBarProps, TimelineItem } from '@/components/patterns/types'
import { highlightFormula } from '@/lib/rules/formulaHighlight'
import { currencyExponent } from '@/shared/constants/currency'
import type { ActorType } from '@/shared/enums/audit'

const EDIT_BUDGET_DENIED = "You don't have permission to edit the budget."
const REQUEST_BUDGET_DENIED = "You don't have permission to request a budget change."
const OVER_COMMITTED = 'Remaining is negative — this project is over-committed.'
const NO_CARD_LIMITS_MOVED = 'No card limits moved.'
const CATEGORIES_EXCEED = 'Category allocations exceed the approved amount.'
const FORMULA_TOO_LONG = 'Expression must be at most 500 characters.'
const ATTRIBUTE_FORMULA_A6 = 'This identifier is an attribute. Attribute formulas land in A6.'

export const BUDGET_TERM_TOOLTIPS: Record<
  'approved' | 'committed' | 'actual' | 'remaining',
  string
> = {
  approved: 'Total approved for this project',
  committed: 'Approved but not yet spent',
  actual: 'Already spent',
  remaining: 'Approved minus committed minus actual',
}

export const FORMULA_FUNCTION_IDENTS: ReadonlySet<string> = new Set([
  'min',
  'max',
  'round',
  'floor',
  'ceil',
  'clamp',
  'pct',
])

export const FORMULA_DEBOUNCE_MS = 300
export const MAX_FORMULA_LENGTH = 500

export const BUDGET_NAV = [
  { suffix: '', label: 'Overview' },
  { suffix: '/categories', label: 'Categories' },
  { suffix: '/history', label: 'History' },
  { suffix: '/requests', label: 'Requests' },
] as const satisfies readonly {
  suffix: '' | '/categories' | '/history' | '/requests'
  label: 'Overview' | 'Categories' | 'History' | 'Requests'
}[]

export type BudgetNavSuffix = (typeof BUDGET_NAV)[number]['suffix']

export type CardTransactionLimitSnapshot = {
  cardId: string
  nickName: string
  maskedNumber: string
  currency: string
  limits: { interval: string; amount: number }[]
}

export type CardTransactionLimitDiff = {
  cardId: string
  nickName: string
  maskedNumber: string
  interval: string
  currency: string
  beforeAmount: number
  afterAmount: number
}

function requireProjectId(projectId: string): string {
  if (projectId.length < 1) {
    throw new Error('projectId is required')
  }
  return projectId
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringMin1(value: unknown): string | null {
  return typeof value === 'string' && value.length >= 1 ? value : null
}

export function budgetHref(projectId: string): string {
  return `/projects/${requireProjectId(projectId)}/budget`
}

export function budgetCategoriesHref(projectId: string): string {
  return `${budgetHref(projectId)}/categories`
}

export function budgetHistoryHref(projectId: string): string {
  return `${budgetHref(projectId)}/history`
}

export function budgetRequestsHref(projectId: string): string {
  return `${budgetHref(projectId)}/requests`
}

export function budgetNavHref(projectId: string, suffix: BudgetNavSuffix): string {
  return `${budgetHref(projectId)}${suffix}`
}

export function isBudgetNavActive(
  pathname: string,
  projectId: string,
  suffix: BudgetNavSuffix,
): boolean {
  const href = budgetNavHref(projectId, suffix)
  if (suffix === '') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function cardsTabHref(projectId: string): string {
  return `/projects/${requireProjectId(projectId)}/cards`
}

export function formulaContextFromBudget(approvedAmount: number): { approvedAmount: number } {
  return { approvedAmount }
}

export function formulaIdentTokens(expression: string): string[] {
  const seen = new Set<string>()
  const idents: string[] = []
  for (const token of highlightFormula(expression)) {
    if (token.type !== 'ident') continue
    if (FORMULA_FUNCTION_IDENTS.has(token.value)) continue
    if (seen.has(token.value)) continue
    seen.add(token.value)
    idents.push(token.value)
  }
  return idents
}

export function formulaExpressionTooLong(expression: string): boolean {
  return expression.length > MAX_FORMULA_LENGTH
}

export function isFormulaExpressionEmpty(expression: string): boolean {
  return expression.trim().length === 0
}

export function allocationsSum(categories: ReadonlyArray<{ allocated: number }>): number {
  let sum = 0
  for (const category of categories) {
    sum += category.allocated
  }
  return sum
}

export function allocationsExceedApproved(sum: number, approvedAmount: number): boolean {
  return sum > approvedAmount
}

export function pendingChangeRequests<T extends { status: string }>(rows: readonly T[]): T[] {
  return rows.filter((row) => row.status === 'PENDING')
}

export function snapshotCardTransactionLimits(
  cards: ReadonlyArray<{
    id: string
    nickName: string
    maskedNumber: string
    desiredControls: {
      transactionLimits: { currency: string; limits: { interval: string; amount: number }[] }
    }
  }>,
): CardTransactionLimitSnapshot[] {
  return cards.map((card) => ({
    cardId: card.id,
    nickName: card.nickName,
    maskedNumber: card.maskedNumber,
    currency: card.desiredControls.transactionLimits.currency,
    limits: card.desiredControls.transactionLimits.limits.map((limit) => ({
      interval: limit.interval,
      amount: limit.amount,
    })),
  }))
}

export function diffCardTransactionLimits(
  before: ReadonlyArray<CardTransactionLimitSnapshot>,
  after: ReadonlyArray<CardTransactionLimitSnapshot>,
): CardTransactionLimitDiff[] {
  const beforeById = new Map(before.map((card) => [card.cardId, card]))
  const diffs: CardTransactionLimitDiff[] = []
  for (const card of after) {
    const previous = beforeById.get(card.cardId)
    const beforeAmounts = new Map(
      (previous?.limits ?? []).map((limit) => [limit.interval, limit.amount]),
    )
    const afterAmounts = new Map(card.limits.map((limit) => [limit.interval, limit.amount]))
    const intervals = new Set([...beforeAmounts.keys(), ...afterAmounts.keys()])
    for (const interval of intervals) {
      const beforeAmount = beforeAmounts.get(interval) ?? 0
      const afterAmount = afterAmounts.get(interval) ?? 0
      if (beforeAmount === afterAmount) continue
      diffs.push({
        cardId: card.cardId,
        nickName: card.nickName,
        maskedNumber: card.maskedNumber,
        interval,
        currency: card.currency,
        beforeAmount,
        afterAmount,
      })
    }
  }
  return diffs
}

export function cardLimitDiffToDiffView(diffs: ReadonlyArray<CardTransactionLimitDiff>): {
  before: Record<string, { amount: number; currency: string }>
  after: Record<string, { amount: number; currency: string }>
} {
  const before: Record<string, { amount: number; currency: string }> = {}
  const after: Record<string, { amount: number; currency: string }> = {}
  for (const diff of diffs) {
    const key = `${diff.nickName} ${diff.maskedNumber} ${diff.interval}`
    before[key] = { amount: diff.beforeAmount, currency: diff.currency }
    after[key] = { amount: diff.afterAmount, currency: diff.currency }
  }
  return { before, after }
}

export function toBudgetHistoryTimelineItem(entry: {
  id: string
  action: string
  actorType: ActorType
  actorId: string
  subjectType: string
  subjectId: string
  at: string
}): TimelineItem {
  return {
    id: entry.id,
    at: entry.at,
    actorType: entry.actorType,
    actorId: entry.actorId,
    summary: entry.action,
    subjectType: entry.subjectType,
    subjectId: entry.subjectId,
  }
}

export function budgetHistoryReason(entry: {
  metadata: Record<string, unknown>
  after?: unknown
}): string | null {
  const fromMetadata = stringMin1(entry.metadata.reason) ?? stringMin1(entry.metadata.note)
  if (fromMetadata) return fromMetadata
  if (!isPlainObject(entry.after)) return null
  return stringMin1(entry.after.reason)
}

export function projectionToBudgetBarProps(
  projection: {
    approved: number
    committed: number
    actual: number
    remaining: number
    utilisationPct: number
    overCommitted: boolean
  },
  currency: string,
): BudgetBarProps {
  return {
    currency,
    approved: projection.approved,
    committed: projection.committed,
    actual: projection.actual,
    remaining: projection.remaining,
    utilisationPct: projection.utilisationPct,
    overCommitted: projection.overCommitted,
  }
}

export function hasBudgetRecord(budget: unknown | null): boolean {
  return budget !== null && typeof budget === 'object'
}

export function editBudgetDenialMessage(): string {
  return EDIT_BUDGET_DENIED
}

export function requestBudgetDenialMessage(): string {
  return REQUEST_BUDGET_DENIED
}

export function overCommittedMessage(): string {
  return OVER_COMMITTED
}

export function noCardLimitsMovedMessage(): string {
  return NO_CARD_LIMITS_MOVED
}

export function categoriesExceedMessage(): string {
  return CATEGORIES_EXCEED
}

export function formulaTooLongMessage(): string {
  return FORMULA_TOO_LONG
}

export function attributeFormulaLandsInA6Message(): string {
  return ATTRIBUTE_FORMULA_A6
}

export function minorToInputString(amount: number, currency: string): string {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return String(amount)
  }
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const factor = 10 ** exp
  const major = Math.trunc(abs / factor)
  const frac = abs % factor
  if (frac === 0) {
    return `${sign}${major}`
  }
  return `${sign}${major}.${String(frac).padStart(exp, '0')}`
}

export function attributeValueForIdent<T extends { key: string }>(
  ident: string,
  values: ReadonlyArray<T>,
): T | undefined {
  return values.find((value) => value.key === ident)
}
