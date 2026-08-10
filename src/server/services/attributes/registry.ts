/**
 * Attribute registry: the built-in catalogue plus the connector interface.
 *
 * Push beats poll — MANUAL and WEBHOOK sources emit `attribute.updated` the
 * moment a value lands. A CONNECTOR cannot beat its own `refreshIntervalSec`,
 * so that interval is the floor on end-to-end latency for anything it feeds.
 */
import type { OrgContext } from '@/server/http/types'
import { AttributeScope } from '@/shared/enums/attributeScope'
import type { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import type { AttributeLiteral } from '@/shared/types/attribute'

export type AttributeSubject = {
  subjectType: AttributeSubjectType
  subjectId: string
}

/** Catalogue entry for a computed attribute — not stored, always derived. */
export type BuiltinAttributeDefinition = {
  key: string
  label: string
  type: AttributeType
  scope: AttributeScope
  unit: string | null
}

const number = (
  key: string,
  label: string,
  scope: AttributeScope,
  unit: string | null = null,
): BuiltinAttributeDefinition => ({ key, label, type: AttributeType.NUMBER, scope, unit })

const text = (key: string, label: string, scope: AttributeScope): BuiltinAttributeDefinition => ({
  key,
  label,
  type: AttributeType.STRING,
  scope,
  unit: null,
})

const date = (key: string, label: string, scope: AttributeScope): BuiltinAttributeDefinition => ({
  key,
  label,
  type: AttributeType.DATE,
  scope,
  unit: null,
})

/**
 * Built-ins from RULES-ENGINE §2. Templated keys
 * (`project.category.{id}.remaining`, `card.remaining.{interval}`) are resolved
 * per subject and so are not enumerated here.
 */
export const BUILTIN_ATTRIBUTE_DEFINITIONS: readonly BuiltinAttributeDefinition[] = [
  text('org.baseCurrency', 'Base currency', AttributeScope.ORG),
  text('project.status', 'Project status', AttributeScope.PROJECT),
  text('project.approvalStatus', 'Approval status', AttributeScope.PROJECT),
  date('project.startDate', 'Start date', AttributeScope.PROJECT),
  date('project.endDate', 'End date', AttributeScope.PROJECT),
  number('project.budget.approved', 'Approved budget', AttributeScope.PROJECT, 'minor'),
  number('project.budget.committed', 'Committed budget', AttributeScope.PROJECT, 'minor'),
  number('project.budget.actual', 'Actual spend', AttributeScope.PROJECT, 'minor'),
  number('project.budget.remaining', 'Remaining budget', AttributeScope.PROJECT, 'minor'),
  number('project.budget.utilisationPct', 'Budget utilisation', AttributeScope.PROJECT, '%'),
  number('project.headcount', 'Headcount', AttributeScope.PROJECT, 'people'),
  number('project.daysRemaining', 'Days remaining', AttributeScope.PROJECT, 'days'),
  text('member.role', 'Member role', AttributeScope.MEMBER),
  text('member.scope.level', 'Member scope level', AttributeScope.MEMBER),
  number('member.spend.mtd', 'Member spend MTD', AttributeScope.MEMBER, 'minor'),
  text('card.purpose', 'Card purpose', AttributeScope.CARD),
  text('card.status', 'Card status', AttributeScope.CARD),
]

const BUILTIN_KEYS = new Set(BUILTIN_ATTRIBUTE_DEFINITIONS.map((entry) => entry.key))

/** True for enumerated built-ins and the two templated key families. */
export function isBuiltinAttributeKey(key: string): boolean {
  if (BUILTIN_KEYS.has(key)) {
    return true
  }
  return /^project\.category\..+\.remaining$/.test(key) || /^card\.remaining\..+$/.test(key)
}

export type ConnectorReading = {
  key: string
  value: AttributeLiteral
  /** ISO 8601 — when the source produced the value, not when we fetched it. */
  observedAt: string
  ttlSec?: number | null
}

/** Keep this interface tiny so new sources stay cheap to add. */
export interface AttributeConnector {
  id: string
  label: string
  fetch(ctx: OrgContext, subject: AttributeSubject): Promise<ConnectorReading[]>
}

/**
 * Stub "Campaign Analytics" connector so the CONNECTOR path is demonstrably
 * wired. Deterministic and offline — it never makes a network call.
 */
export const campaignAnalyticsConnector: AttributeConnector = {
  id: 'campaign-analytics',
  label: 'Campaign Analytics',
  async fetch(_ctx: OrgContext, subject: AttributeSubject): Promise<ConnectorReading[]> {
    const observedAt = new Date().toISOString()
    return [
      { key: 'campaign.roas', value: 2.4, observedAt, ttlSec: 900 },
      { key: 'campaign.status', value: 'RUNNING', observedAt, ttlSec: 900 },
      { key: 'campaign.subject', value: subject.subjectId, observedAt, ttlSec: 900 },
    ]
  },
}

const CONNECTORS: readonly AttributeConnector[] = [campaignAnalyticsConnector]

export function findConnector(connectorId: string): AttributeConnector | null {
  return CONNECTORS.find((connector) => connector.id === connectorId) ?? null
}

export function listConnectors(): readonly AttributeConnector[] {
  return CONNECTORS
}
