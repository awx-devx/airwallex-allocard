/**
 * Attribute resolution: load the built-in snapshots plus stored custom values
 * and hand the evaluation pipeline one indexed context.
 *
 * Staleness is decided here, never papered over. A value past `observedAt + ttlSec`
 * is returned marked `stale: true` so the caller can record `SKIPPED: stale input`
 * with the key named. A key with no reading at all is *missing* and fails the run.
 * Neither case ever resolves to zero.
 */
import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { findAttributeValuesBySubjects } from '@/server/repositories/attributeValues'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { listCards } from '@/server/repositories/cards'
import { findOrganizationById } from '@/server/repositories/organizations'
import { listActiveProjectMembers } from '@/server/repositories/projectMembers'
import { findProjectById } from '@/server/repositories/projects'
import { listRoles } from '@/server/repositories/roles'
import { projectBudget } from '@/server/services/budget/projectProjection'
import {
  computeBuiltinAttributes,
  projectApprovalStatus,
  type BuiltinSnapshot,
  type CardAttributeSnapshot,
  type MemberAttributeSnapshot,
  type ProjectAttributeSnapshot,
  type ResolvedAttribute,
} from '@/server/services/attributes/builtins'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { AttributeValue } from '@/shared/types/attribute'
import type { AttributeOverride } from '@/shared/types/ruleRun'

export type AttributeSubjectRef = {
  subjectType: AttributeSubjectType
  subjectId: string
}

export type AttributeContext = {
  /** ISO evaluation timestamp — every computed reading observes at this instant. */
  now: string
  readings: ResolvedAttribute[]
  index: Map<string, ResolvedAttribute>
}

export type BuildAttributeContextOptions = {
  projectId?: string | null
  /** Live per-interval remaining, when the caller has already loaded it. */
  cardLimits?: Map<string, Partial<Record<TransactionLimitInterval, number>>>
  /** Simulation only — replaces a value and treats it as freshly observed. */
  overrides?: AttributeOverride[]
  now?: Date
}

export function contextKey(key: string, subject: AttributeSubjectRef): string {
  return `${key}|${subject.subjectType}|${subject.subjectId}`
}

export function isStale(observedAt: string, ttlSec: number | null, now: Date): boolean {
  if (ttlSec === null) {
    return false
  }
  return new Date(observedAt).getTime() + ttlSec * 1000 < now.getTime()
}

function storedToReading(value: AttributeValue, now: Date): ResolvedAttribute {
  return {
    key: value.key,
    subjectType: value.subjectType,
    subjectId: value.subjectId,
    value: value.value,
    observedAt: value.observedAt,
    ttlSec: value.ttlSec,
    source: value.source,
    stale: isStale(value.observedAt, value.ttlSec, now),
  }
}

function indexReadings(readings: ResolvedAttribute[]): Map<string, ResolvedAttribute> {
  const index = new Map<string, ResolvedAttribute>()
  for (const reading of readings) {
    index.set(contextKey(reading.key, reading), reading)
  }
  return index
}

async function loadProjectSnapshot(
  ctx: OrgContext,
  projectId: string,
): Promise<{
  project: ProjectAttributeSnapshot
  members: MemberAttributeSnapshot[]
  cards: CardAttributeSnapshot[]
  cardIds: string[]
  memberIds: string[]
} | null> {
  const project = await findProjectById(ctx, projectId)
  if (!project) {
    return null
  }

  const [budget, members, roles, cardPage] = await Promise.all([
    findBudgetByProject(ctx, projectId),
    listActiveProjectMembers(ctx, projectId),
    listRoles(ctx),
    listCards(ctx, { projectId, pageSize: 100 }),
  ])

  const projection =
    project.budgetSnapshot ??
    (budget ? { ...projectBudget(await findEntriesByProject(ctx, projectId)) } : null)

  const categoryRemaining = (budget?.categories ?? []).map((category) => ({
    categoryId: category.id,
    // Allocation minus category-attributed spend arrives with B8 transactions;
    // until then the allocation itself is the remaining figure.
    remaining: category.allocated,
  }))

  const roleKeyById = new Map(roles.map((role) => [role.id, role.key]))

  return {
    project: {
      projectId: project.id,
      status: project.status,
      approvalStatus: projectApprovalStatus({
        status: project.status,
        approvedAt: project.approvedAt,
      }),
      startDate: project.startDate,
      endDate: project.endDate,
      headcount: members.length,
      budget: projection
        ? {
            approved: projection.approved,
            committed: projection.committed,
            actual: projection.actual,
            remaining: projection.remaining,
            utilisationPct: projection.utilisationPct,
          }
        : null,
      categoryRemaining,
    },
    members: members.map((member) => ({
      userId: member.userId,
      roleKey: roleKeyById.get(member.roleId) ?? null,
      scopeLevel: member.scope.level,
      // TODO(B8): month-to-date spend needs cleared transactions. Null keeps the
      // attribute missing, so a rule reading it fails loudly instead of seeing 0.
      spendMtd: null,
    })),
    cards: cardPage.items.map((card) => ({
      cardId: card.id,
      purpose: card.purpose,
      status: card.status,
    })),
    cardIds: cardPage.items.map((card) => card.id),
    memberIds: members.map((member) => member.userId),
  }
}

/**
 * Build the full evaluation context for a subject: built-ins plus every stored
 * custom value for the org, project, members, and cards in play.
 */
export async function buildAttributeContext(
  ctx: OrgContext,
  options: BuildAttributeContextOptions = {},
): Promise<AttributeContext> {
  await connectDb()

  const now = options.now ?? new Date()
  const org = await findOrganizationById(ctx.orgId)
  const snapshot: BuiltinSnapshot = {
    org: {
      orgId: ctx.orgId,
      baseCurrency: org?.baseCurrency ?? 'USD',
    },
  }

  const subjects: AttributeSubjectRef[] = [
    { subjectType: AttributeSubjectType.ORG, subjectId: ctx.orgId },
  ]

  if (options.projectId) {
    const loaded = await loadProjectSnapshot(ctx, options.projectId)
    if (loaded) {
      snapshot.project = loaded.project
      snapshot.members = loaded.members
      snapshot.cards = loaded.cards.map((card) => ({
        ...card,
        remainingByInterval: options.cardLimits?.get(card.cardId),
      }))

      subjects.push({
        subjectType: AttributeSubjectType.PROJECT,
        subjectId: options.projectId,
      })
      for (const userId of loaded.memberIds) {
        subjects.push({ subjectType: AttributeSubjectType.MEMBER, subjectId: userId })
      }
      for (const cardId of loaded.cardIds) {
        subjects.push({ subjectType: AttributeSubjectType.CARD, subjectId: cardId })
      }
    }
  }

  const readings = computeBuiltinAttributes(snapshot, now)

  for (const value of await findAttributeValuesBySubjects(ctx, subjects)) {
    readings.push(storedToReading(value, now))
  }

  for (const override of options.overrides ?? []) {
    const reading: ResolvedAttribute = {
      key: override.key,
      subjectType: override.subjectType,
      subjectId: override.subjectId,
      value: override.value,
      observedAt: now.toISOString(),
      ttlSec: null,
      source: AttributeSource.MANUAL,
      stale: false,
    }
    const existing = readings.findIndex(
      (entry) => contextKey(entry.key, entry) === contextKey(reading.key, reading),
    )
    if (existing >= 0) {
      readings[existing] = reading
    } else {
      readings.push(reading)
    }
  }

  return {
    now: now.toISOString(),
    readings,
    index: indexReadings(readings),
  }
}

/**
 * Find a reading by key. Attribute keys are namespaced by subject
 * (`project.*`, `member.*`, `card.*`), so a bare key is unambiguous within one
 * evaluation unless a subject is given explicitly.
 */
export function lookupAttribute(
  context: AttributeContext,
  key: string,
  subject?: AttributeSubjectRef,
): ResolvedAttribute | null {
  if (subject) {
    return context.index.get(contextKey(key, subject)) ?? null
  }
  return context.readings.find((reading) => reading.key === key) ?? null
}

export type AttributeRequirement = {
  resolved: ResolvedAttribute[]
  /** Keys with no reading at all — the run fails and names them. */
  missing: string[]
  /** Keys past their TTL — the run is skipped and names them. */
  stale: string[]
}

/** Resolve every key a rule references, separating missing from stale. */
export function requireAttributes(
  context: AttributeContext,
  keys: readonly string[],
  subject?: AttributeSubjectRef,
): AttributeRequirement {
  const resolved: ResolvedAttribute[] = []
  const missing: string[] = []
  const stale: string[] = []

  for (const key of keys) {
    const reading = lookupAttribute(context, key, subject)
    if (!reading) {
      missing.push(key)
      continue
    }
    resolved.push(reading)
    if (reading.stale) {
      stale.push(key)
    }
  }

  return { resolved, missing, stale }
}
