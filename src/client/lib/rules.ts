/**
 * A6 controls & automation screen helpers. Pure — no React.
 *
 * Formula evaluation is server-side (`useValidateRule` / `useSimulateRules`).
 * This file tokenizes nothing and does not parse the DSL.
 */
import {
  type ControlsDiffInput,
  controlsHref,
  controlsToDiffView,
  ruleHref,
} from '@/client/lib/cards'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { OrgRole } from '@/shared/enums/orgRole'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { listAttributesQuery } from '@/shared/schemas/attribute'
import { listRulesQuery } from '@/shared/schemas/rule'
import { listRuleRunsQuery } from '@/shared/schemas/ruleRun'
import type { ListAttributesQuery } from '@/shared/types/attribute'
import type { Condition, CreateRuleInput, ListRulesQuery, RuleScope } from '@/shared/types/rule'
import type { ListRuleRunsQuery } from '@/shared/types/ruleRun'

export { controlsHref, ruleHref }

const EDIT_CONTROLS_DENIED = "You don't have permission to edit controls."
const RULE_NOT_FOUND = 'This rule is not available.'
const NEVER_RUN = 'This rule has never run.'
const LAST_RUN_UNMATCHED = 'Last run did not match.'
const PARTIAL_RUN = 'This run is partial — a rule wanted something impossible.'
const SIMULATION_HYPOTHETICAL =
  'This is a simulation. Nothing is written to Airwallex or the database.'
const WEBHOOK_SECRET_WRITE_ONLY = 'The webhook secret is write-only and is never shown again.'
const INGEST_NOT_ON_SCREEN = 'Values arrive via webhook ingest, not this screen.'
const ALLOW_DESTRUCTIVE_CLOSE =
  'Closing a card is terminal. Check allow destructive to include card.close.'
const WIZARD_CONTROLS_LINK = 'Set project rules on the controls tab.'
const MATCH_NONE = "With today's values, this rule matches no cards."

export const NEW_RULE_ID = 'new'
export const DRAFT_RULE_ID = 'draft'
export const CAMPAIGN_ANALYTICS_CONNECTOR_ID = 'campaign-analytics'
export const RULE_VALIDATE_DEBOUNCE_MS = 300
/** Same 500 cap as budget `MAX_FORMULA_LENGTH` — not re-exported (barrel clash). */
export const TEMPLATE_PROJECT_ID = 'TEMPLATE_PROJECT'

export type RuleTemplateKey = 'A' | 'B' | 'C' | 'D' | 'E'

export type BuiltinAttributeKey = {
  key: string
  label: string
  scope: 'ORG' | 'PROJECT' | 'MEMBER' | 'CARD'
}

export type ProjectControlsSearch = ListRulesQuery & { ruleId?: string }

export const RULE_TRIGGER_EVENTS: readonly string[] = [
  'project.created',
  'project.approved',
  'project.launched',
  'project.closing',
  'project.closed',
  'budget.approved',
  'budget.updated',
  'budget.threshold_crossed',
  'member.added',
  'member.role_changed',
  'member.scope_changed',
  'member.removed',
  'card.created',
  'card.status_changed',
  'card.limit_updated',
  'request.created',
  'request.submitted',
  'request.approved',
  'request.rejected',
  'request.cancelled',
  'transaction.authorized',
  'transaction.cleared',
  'transaction.declined',
  'transaction.reversed',
  'attribute.updated',
]

export const BUILTIN_ATTRIBUTE_KEYS: readonly BuiltinAttributeKey[] = [
  { key: 'org.baseCurrency', label: 'Base currency', scope: 'ORG' },
  { key: 'project.status', label: 'Project status', scope: 'PROJECT' },
  { key: 'project.approvalStatus', label: 'Approval status', scope: 'PROJECT' },
  { key: 'project.startDate', label: 'Start date', scope: 'PROJECT' },
  { key: 'project.endDate', label: 'End date', scope: 'PROJECT' },
  { key: 'project.budget.approved', label: 'Approved budget', scope: 'PROJECT' },
  { key: 'project.budget.committed', label: 'Committed budget', scope: 'PROJECT' },
  { key: 'project.budget.actual', label: 'Actual spend', scope: 'PROJECT' },
  { key: 'project.budget.remaining', label: 'Remaining budget', scope: 'PROJECT' },
  { key: 'project.budget.utilisationPct', label: 'Budget utilisation', scope: 'PROJECT' },
  { key: 'project.headcount', label: 'Headcount', scope: 'PROJECT' },
  { key: 'project.daysRemaining', label: 'Days remaining', scope: 'PROJECT' },
  { key: 'member.role', label: 'Member role', scope: 'MEMBER' },
  { key: 'member.scope.level', label: 'Member scope level', scope: 'MEMBER' },
  { key: 'member.spend.mtd', label: 'Member spend MTD', scope: 'MEMBER' },
  { key: 'card.purpose', label: 'Card purpose', scope: 'CARD' },
  { key: 'card.status', label: 'Card status', scope: 'CARD' },
]

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

function isControlsDiffInput(value: unknown): value is ControlsDiffInput {
  if (!isPlainObject(value)) return false
  const limits = value.transactionLimits
  if (
    !isPlainObject(limits) ||
    typeof limits.currency !== 'string' ||
    !Array.isArray(limits.limits)
  ) {
    return false
  }
  return typeof value.allowedTransactionCount === 'string'
}

export function orgRulesHref(): string {
  return '/settings/rules'
}

export function ruleBuilderHref(ruleId: string): string {
  return `/settings/rules/${requireId(ruleId, 'ruleId')}`
}

export function newRuleHref(template?: string): string {
  return appendQuery('/settings/rules/new', [
    ['template', template !== undefined && template.length >= 1 ? template : undefined],
  ])
}

export function newProjectRuleHref(projectId: string, template?: string): string {
  return appendQuery('/settings/rules/new', [
    ['projectId', requireId(projectId, 'projectId')],
    ['template', template !== undefined && template.length >= 1 ? template : undefined],
  ])
}

export function parseOptionalIdParam(input: string | string[] | undefined): string | undefined {
  const value = firstParam(input)
  if (value === undefined || value.length < 1) {
    return undefined
  }
  return value
}

export function ruleSimulateHref(ruleId: string): string {
  return `/settings/rules/${requireId(ruleId, 'ruleId')}/simulate`
}

export function automationHref(): string {
  return '/automation'
}

export function attributesHref(): string {
  return '/settings/attributes'
}

export function cardExplainHref(cardId: string): string {
  return `/cards/${requireId(cardId, 'cardId')}/explain`
}

export function parseRuleListSearchParams(input: {
  projectId?: string | string[]
  enabled?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
}): ListRulesQuery {
  const raw: Record<string, string> = {}
  const projectId = firstParam(input.projectId)
  const enabled = firstParam(input.enabled)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  if (projectId !== undefined) raw.projectId = projectId
  if (enabled !== undefined) raw.enabled = enabled
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listRulesQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 } as ListRulesQuery
  }
  return parsed.data
}

export function ruleListHref(filter: {
  projectId?: string
  enabled?: boolean
  page?: number
  pageSize?: number
}): string {
  return appendQuery('/settings/rules', [
    ['projectId', filter.projectId],
    ['enabled', filter.enabled === undefined ? undefined : filter.enabled ? 'true' : 'false'],
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function projectControlsHref(
  projectId: string,
  filter?: { enabled?: boolean; page?: number; pageSize?: number; ruleId?: string },
): string {
  return appendQuery(controlsHref(projectId), [
    ['enabled', filter?.enabled === undefined ? undefined : filter.enabled ? 'true' : 'false'],
    ['page', filter?.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter?.pageSize !== undefined && filter.pageSize !== 20
        ? String(filter.pageSize)
        : undefined,
    ],
    ['ruleId', filter?.ruleId],
  ])
}

export function parseProjectControlsSearchParams(input: {
  projectId?: string | string[]
  enabled?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
  ruleId?: string | string[]
}): ProjectControlsSearch {
  const list = parseRuleListSearchParams(input)
  const ruleId = parseOptionalIdParam(input.ruleId)
  if (ruleId === undefined) {
    return list
  }
  return { ...list, ruleId }
}

export function parseRuleRunSearchParams(input: {
  ruleId?: string | string[]
  cardId?: string | string[]
  projectId?: string | string[]
  status?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
}): ListRuleRunsQuery {
  const raw: Record<string, string> = {}
  const ruleId = firstParam(input.ruleId)
  const cardId = firstParam(input.cardId)
  const projectId = firstParam(input.projectId)
  const status = firstParam(input.status)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  if (ruleId !== undefined) raw.ruleId = ruleId
  if (cardId !== undefined) raw.cardId = cardId
  if (projectId !== undefined) raw.projectId = projectId
  if (status !== undefined) raw.status = status
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listRuleRunsQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 }
  }
  return parsed.data
}

export function automationListHref(filter: {
  ruleId?: string
  cardId?: string
  projectId?: string
  status?: RuleRunStatus
  page?: number
  pageSize?: number
}): string {
  return appendQuery('/automation', [
    ['ruleId', filter.ruleId],
    ['cardId', filter.cardId],
    ['projectId', filter.projectId],
    ['status', filter.status],
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function parseAttributeListSearchParams(input: {
  scope?: string | string[]
  source?: string | string[]
  page?: string | string[]
  pageSize?: string | string[]
}): ListAttributesQuery {
  const raw: Record<string, string> = {}
  const scope = firstParam(input.scope)
  const source = firstParam(input.source)
  const page = firstParam(input.page)
  const pageSize = firstParam(input.pageSize)
  if (scope !== undefined) raw.scope = scope
  if (source !== undefined) raw.source = source
  if (page !== undefined) raw.page = page
  if (pageSize !== undefined) raw.pageSize = pageSize

  const parsed = listAttributesQuery.safeParse(raw)
  if (!parsed.success) {
    return { page: 1, pageSize: 20 }
  }
  return parsed.data
}

export function attributeListHref(filter: {
  scope?: AttributeScope
  source?: AttributeSource
  page?: number
  pageSize?: number
}): string {
  return appendQuery('/settings/attributes', [
    ['scope', filter.scope],
    ['source', filter.source],
    ['page', filter.page !== undefined && filter.page !== 1 ? String(filter.page) : undefined],
    [
      'pageSize',
      filter.pageSize !== undefined && filter.pageSize !== 20 ? String(filter.pageSize) : undefined,
    ],
  ])
}

export function isNewRuleId(id: string): boolean {
  return id === NEW_RULE_ID
}

export function findRuleById<T extends { id: string }>(
  items: ReadonlyArray<T> | undefined,
  id: string,
): T | undefined {
  return items?.find((row) => row.id === id)
}

export function holdsControlEdit(
  orgRole: string | undefined,
  projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined,
): boolean {
  if (orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN) {
    return true
  }
  return Boolean(projects?.some((row) => row.permissions.includes('control.edit')))
}

export function attributeOptions(
  customKeys: ReadonlyArray<{ key: string; label: string }>,
): { value: string; label: string }[] {
  const builtinSet = new Set(BUILTIN_ATTRIBUTE_KEYS.map((row) => row.key))
  const builtins = BUILTIN_ATTRIBUTE_KEYS.map((row) => ({ value: row.key, label: row.label }))
  const extras = customKeys
    .filter((row) => !builtinSet.has(row.key))
    .slice()
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((row) => ({ value: row.key, label: row.label }))
  return [...builtins, ...extras]
}

export function emptyDraftRule(
  scope: { level: 'ORG' } | { level: 'PROJECT'; projectId: string },
): CreateRuleInput {
  return {
    scope,
    name: 'Untitled rule',
    trigger: { events: ['budget.updated'] },
    when: { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
    then: [
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.PROJECT_CARDS },
        params: {},
      },
    ],
  }
}

const PROJECT_TEMPLATE_SCOPE: RuleScope = {
  level: RuleScopeLevel.PROJECT,
  projectId: TEMPLATE_PROJECT_ID,
}

export const RULE_TEMPLATES: Record<RuleTemplateKey, CreateRuleInput> = {
  A: {
    scope: PROJECT_TEMPLATE_SCOPE,
    name: 'Issue member cards on project launch',
    trigger: { events: ['project.launched'] },
    when: {
      all: [
        { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
        { attr: 'project.budget.approved', op: ConditionOperator.GT, value: 0 },
      ],
    },
    then: [
      {
        action: RuleActionType.CARD_CREATE,
        target: {
          select: RuleTargetSelect.PROJECT_MEMBERS,
          filter: { roleKeys: ['project_spender'] },
        },
        params: {
          formFactor: 'VIRTUAL',
          purpose: CardPurpose.MEMBER,
          allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
          transactionLimits: {
            currency: 'USD',
            limits: [
              {
                interval: TransactionLimitInterval.MONTHLY,
                amount: 'project.budget.approved / max(project.headcount, 1) * 0.25',
              },
            ],
          },
          activeFrom: 'project.startDate',
          activeTo: 'project.endDate',
        },
      },
    ],
  },
  B: {
    scope: PROJECT_TEMPLATE_SCOPE,
    name: 'Freeze member cards when budget drops below 10%',
    priority: 10,
    trigger: { events: ['budget.updated'] },
    when: {
      attr: 'project.budget.utilisationPct',
      op: ConditionOperator.CROSSED_ABOVE,
      value: 90,
    },
    then: [
      {
        action: RuleActionType.CARD_FREEZE,
        target: {
          select: RuleTargetSelect.PROJECT_CARDS,
          filter: { purpose: CardPurpose.MEMBER },
        },
        params: { reason: 'Project budget below 10% remaining' },
      },
      {
        action: RuleActionType.NOTIFY,
        target: {
          select: RuleTargetSelect.PROJECT_MEMBERS,
          filter: { roleKeys: ['project_manager'] },
        },
        params: { template: 'budget_floor_breached' },
      },
    ],
  },
  C: {
    scope: PROJECT_TEMPLATE_SCOPE,
    name: 'Scale campaign card with ROAS',
    trigger: { events: ['attribute.updated'] },
    when: {
      all: [
        { attr: 'campaign.roas', op: ConditionOperator.GTE, value: 2.0 },
        { attr: 'campaign.status', op: ConditionOperator.EQ, value: 'RUNNING' },
      ],
    },
    then: [
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.PROJECT_CARDS },
        params: {
          transactionLimits: {
            currency: 'USD',
            limits: [
              {
                interval: TransactionLimitInterval.WEEKLY,
                amount: 'clamp(campaign.roas * 200000, 100000, 2500000)',
              },
            ],
          },
        },
      },
    ],
    else: [
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.PROJECT_CARDS },
        params: {
          transactionLimits: {
            currency: 'USD',
            limits: [{ interval: TransactionLimitInterval.WEEKLY, amount: 100_000 }],
          },
        },
      },
    ],
  },
  D: {
    scope: { level: RuleScopeLevel.ORG },
    name: 'One-time vendor card on approved purchase request',
    trigger: { events: ['request.approved'] },
    when: {
      all: [
        { attr: 'request.type', op: ConditionOperator.EQ, value: 'VENDOR_PAYMENT' },
        { attr: 'request.amount', op: ConditionOperator.LTE, value: 2_500_000 },
      ],
    },
    then: [
      {
        action: RuleActionType.CARD_CREATE,
        target: { select: RuleTargetSelect.EVENT_SUBJECT },
        params: {
          formFactor: 'VIRTUAL',
          purpose: CardPurpose.ONE_TIME,
          allowedTransactionCount: AllowedTransactionCount.SINGLE,
          transactionLimits: {
            currency: 'request.currency',
            limits: [
              {
                interval: TransactionLimitInterval.PER_TRANSACTION,
                amount: 'request.amount * 1.02',
              },
            ],
          },
          allowedMerchantCategories: 'request.vendor.mccList',
          activeToOffsetDays: 7,
        },
      },
    ],
  },
  E: {
    scope: PROJECT_TEMPLATE_SCOPE,
    name: 'Recalculate access on role change',
    trigger: { events: ['member.role_changed', 'member.scope_changed'] },
    when: { attr: 'member.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
    then: [
      {
        action: RuleActionType.ACCESS_GRANT,
        target: { select: RuleTargetSelect.EVENT_SUBJECT },
        params: { recompute: true },
      },
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.MEMBER_CARDS },
        params: {
          transactionLimits: {
            currency: 'USD',
            limits: [
              {
                interval: TransactionLimitInterval.MONTHLY,
                amount: 'min(role.monthlyCap, project.budget.remaining * 0.1)',
              },
            ],
          },
        },
      },
      {
        action: RuleActionType.FLAG_REVIEW,
        target: { select: RuleTargetSelect.EVENT_SUBJECT },
        params: { reason: 'role change' },
      },
    ],
  },
}

export function applyTemplate(
  key: RuleTemplateKey,
  scope: CreateRuleInput['scope'],
): CreateRuleInput {
  const clone = structuredClone(RULE_TEMPLATES[key])
  if (key === 'D') {
    clone.scope = { level: RuleScopeLevel.ORG }
    return clone
  }
  clone.scope = scope
  return clone
}

export function parseTemplateParam(input: {
  template?: string | string[]
}): RuleTemplateKey | null {
  const raw = firstParam(input.template)
  if (raw === undefined) {
    return null
  }
  const key = raw.toUpperCase()
  if (key === 'A' || key === 'B' || key === 'C' || key === 'D' || key === 'E') {
    return key
  }
  return null
}

export function toCreateRuleInput(draft: CreateRuleInput): CreateRuleInput {
  const next: CreateRuleInput = {
    scope: draft.scope,
    name: draft.name,
    trigger: draft.trigger,
    when: draft.when,
    then: draft.then,
  }
  if (draft.description !== undefined && draft.description !== '') {
    next.description = draft.description
  }
  if (draft.enabled !== undefined) {
    next.enabled = draft.enabled
  }
  if (draft.priority !== undefined) {
    next.priority = draft.priority
  }
  if (draft.else !== undefined && draft.else.length > 0) {
    next.else = draft.else
  }
  return next
}

export function parseFormulaOrInt(raw: string): string | number {
  const trimmed = raw.trim()
  if (trimmed.length < 1) {
    return ''
  }
  if (/^-?\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10)
  }
  return trimmed
}

export function parseConditionValue(raw: string): string | number | boolean | null {
  const trimmed = raw.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (trimmed === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed)
  }
  return trimmed
}

export function parseCommaList(raw: string): string[] | null {
  const items = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
  return items.length === 0 ? null : items
}

export function parseIntInput(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    return undefined
  }
  return Number.parseInt(trimmed, 10)
}

export function conditionMode(when: Condition): 'all' | 'any' | 'attr' | 'expr' | 'not' {
  if (when.not !== undefined) return 'not'
  if (when.all !== undefined) return 'all'
  if (when.any !== undefined) return 'any'
  if (when.expr !== undefined) return 'expr'
  return 'attr'
}

export function wrapNot(when: Condition, negate: boolean): Condition {
  if (negate) {
    return when.not !== undefined ? when : { not: when }
  }
  return when.not !== undefined ? when.not : when
}

type SimulateCard = {
  cardId: string
  controls?: {
    transactionLimits?: { currency: string; limits: { interval: string; amount: number }[] }
  }
}

type SimulateRun = {
  ruleId: string
  matched: boolean
  desiredState: { cards: ReadonlyArray<SimulateCard> }
}

export function matchPreviewFromSimulate(
  output: { runs: ReadonlyArray<SimulateRun>; cardDiffs: unknown[] },
  ruleId: string,
): {
  matchedCardCount: number
  sampleLimit: { interval: string; amount: number; currency: string } | null
} {
  const run = output.runs.find((row) => row.ruleId === ruleId)
  if (!run || !run.matched) {
    return { matchedCardCount: 0, sampleLimit: null }
  }
  const ids = new Set(run.desiredState.cards.map((card) => card.cardId))
  const first = run.desiredState.cards[0]?.controls?.transactionLimits
  const firstLimit = first?.limits[0]
  const sampleLimit =
    first !== undefined && firstLimit !== undefined && typeof firstLimit.amount === 'number'
      ? { interval: firstLimit.interval, amount: firstLimit.amount, currency: first.currency }
      : null
  return { matchedCardCount: ids.size, sampleLimit }
}

export function formatMatchPreview(
  stats: {
    matchedCardCount: number
    sampleLimit: { interval: string; amount: number; currency: string } | null
  },
  formatMoney: (m: { amount: number; currency: string }) => string,
): string {
  if (stats.matchedCardCount < 1) {
    return MATCH_NONE
  }
  if (stats.sampleLimit === null) {
    return `With today's values, this rule matches ${stats.matchedCardCount} cards.`
  }
  const money = formatMoney({
    amount: stats.sampleLimit.amount,
    currency: stats.sampleLimit.currency,
  })
  return `With today's values, this rule matches ${stats.matchedCardCount} cards and would set the ${stats.sampleLimit.interval} limit to ${money}.`
}

export function cardDiffToDiffView(diff: {
  before: { controls: unknown; cardStatus: unknown }
  after: { controls: unknown; cardStatus: unknown }
}): { before: Record<string, unknown>; after: Record<string, unknown> } {
  const before: Record<string, unknown> = { cardStatus: diff.before.cardStatus }
  const after: Record<string, unknown> = { cardStatus: diff.after.cardStatus }
  if (diff.after.controls === null) {
    return { before, after }
  }
  if (isControlsDiffInput(diff.before.controls) && isControlsDiffInput(diff.after.controls)) {
    const view = controlsToDiffView(diff.before.controls, diff.after.controls)
    return {
      before: { cardStatus: diff.before.cardStatus, ...view.before },
      after: { cardStatus: diff.after.cardStatus, ...view.after },
    }
  }
  return { before, after }
}

function appendControlFields(target: Record<string, unknown>, controls: Record<string, unknown>) {
  if (controls.allowedTransactionCount !== undefined) {
    target.allowedTransactionCount = controls.allowedTransactionCount
  }
  if (controls.activeFrom !== undefined) target.activeFrom = controls.activeFrom
  if (controls.activeTo !== undefined) target.activeTo = controls.activeTo
  if (controls.allowedCurrencies !== undefined) {
    target.allowedCurrencies = controls.allowedCurrencies
  }
  if (controls.allowedMerchantCategories !== undefined) {
    target.allowedMerchantCategories = controls.allowedMerchantCategories
  }
  if (controls.allowedMerchantCountries !== undefined) {
    target.allowedMerchantCountries = controls.allowedMerchantCountries
  }
  if (controls.allowedMerchantBrands !== undefined) {
    target.allowedMerchantBrands = controls.allowedMerchantBrands
  }
  if (controls.blockedTransactionUsages !== undefined) {
    target.blockedTransactionUsages = controls.blockedTransactionUsages
  }
  const limits = controls.transactionLimits
  if (
    !isPlainObject(limits) ||
    typeof limits.currency !== 'string' ||
    !Array.isArray(limits.limits)
  ) {
    return
  }
  for (const row of limits.limits) {
    if (!isPlainObject(row) || typeof row.interval !== 'string' || typeof row.amount !== 'number') {
      continue
    }
    target[`limit.${row.interval}`] = { amount: row.amount, currency: limits.currency }
  }
}

/** Flatten a governing-rule contribution so DiffView can render MoneyDisplay limits. */
export function contributionToDiffView(
  contribution: { controls?: unknown; cardStatus?: unknown } | null | undefined,
): { before: null; after: Record<string, unknown> | null } {
  if (contribution == null) {
    return { before: null, after: null }
  }
  const after: Record<string, unknown> = {}
  if (contribution.cardStatus !== undefined) {
    after.cardStatus = contribution.cardStatus
  }
  if (isPlainObject(contribution.controls)) {
    appendControlFields(after, contribution.controls)
  }
  return { before: null, after }
}

export function flattenRunPages(
  pages: ReadonlyArray<{ items: readonly unknown[] }> | undefined,
): unknown[] {
  return pages?.flatMap((page) => page.items) ?? []
}

export function isProminentRunStatus(status: string): boolean {
  return status === RuleRunStatus.FAILED || status === RuleRunStatus.PARTIAL
}

export function orgWideRules<T extends { scope: { level: string } }>(items: ReadonlyArray<T>): T[] {
  return items.filter((row) => row.scope.level === RuleScopeLevel.ORG)
}

export function editControlsDenialMessage(): string {
  return EDIT_CONTROLS_DENIED
}

export function ruleNotFoundMessage(): string {
  return RULE_NOT_FOUND
}

export function neverRunMessage(): string {
  return NEVER_RUN
}

export function lastRunUnmatchedMessage(): string {
  return LAST_RUN_UNMATCHED
}

export function partialRunHeading(): string {
  return PARTIAL_RUN
}

export function simulationHypotheticalMessage(): string {
  return SIMULATION_HYPOTHETICAL
}

export function webhookSecretWriteOnlyMessage(): string {
  return WEBHOOK_SECRET_WRITE_ONLY
}

export function ingestNotOnThisScreenMessage(): string {
  return INGEST_NOT_ON_SCREEN
}

export function allowDestructiveCloseMessage(): string {
  return ALLOW_DESTRUCTIVE_CLOSE
}

export function wizardControlsLinkMessage(): string {
  return WIZARD_CONTROLS_LINK
}

export function noProjectRulesEmpty(): { title: string; description: string } {
  return {
    title: 'No rules yet',
    description:
      'Start from a template — limits are derived from attributes, not typed as a card ceiling.',
  }
}

export function noOrgRulesEmpty(): { title: string; description: string } {
  return {
    title: 'No rules yet',
    description: 'Org-wide rules apply to every project.',
  }
}

export function noSimulateChangesEmpty(): { title: string; description: string } {
  return {
    title: 'No card changes',
    description: 'This simulation would not change any card.',
  }
}
