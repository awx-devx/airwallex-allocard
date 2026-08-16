/**
 * HTTP-facing rule-run list/get and the card explainer.
 * Explain re-runs the pure pipeline for the card's project so "why is my
 * limit $X?" reflects current rules and attributes, then attaches the latest
 * recorded run as history.
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { findCardById } from '@/server/repositories/cards'
import { listEnabledRulesForScope } from '@/server/repositories/rules'
import { findLatestRunForCard, findRuleRunById, listRuleRuns } from '@/server/repositories/ruleRuns'
import { buildAttributeContext } from '@/server/services/attributes/resolve'
import { mergeIntoControls } from '@/server/services/rules/apply'
import {
  loadMembers,
  loadPipelineCards,
  loadPreviousValues,
  desiredStatusOf,
} from '@/server/services/rules/load'
import { mergeContributions } from '@/server/services/rules/merge'
import { runPipeline } from '@/server/services/rules/pipeline'
import { SIMULATION_TRIGGER } from '@/server/services/rules/simulate'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import type { AttributeValue } from '@/shared/types/attribute'
import type { CardExplain, ListRuleRunsQuery, RuleRun, RuleRunList } from '@/shared/types/ruleRun'

export async function listRuleRunsForOrg(
  ctx: OrgContext,
  query: ListRuleRunsQuery,
): Promise<RuleRunList> {
  await connectDb()
  return listRuleRuns(ctx, query)
}

export async function getRuleRunForOrg(ctx: OrgContext, id: string): Promise<RuleRun> {
  await connectDb()
  const run = await findRuleRunById(ctx, id)
  if (!run) {
    throw AppError.notFound()
  }
  return run
}

function readingToAttributeValue(
  ctx: OrgContext,
  reading: {
    key: string
    subjectType: AttributeValue['subjectType']
    subjectId: string
    value: AttributeValue['value']
    observedAt: string
    ttlSec: number | null
    source: AttributeValue['source']
  },
): AttributeValue {
  return {
    id: `reading:${reading.key}:${reading.subjectType}:${reading.subjectId}`,
    orgId: ctx.orgId,
    key: reading.key,
    subjectType: reading.subjectType,
    subjectId: reading.subjectId,
    value: reading.value,
    observedAt: reading.observedAt,
    source: reading.source,
    ttlSec: reading.ttlSec,
    createdAt: reading.observedAt,
    updatedAt: reading.observedAt,
  }
}

/** Explain why this card's limits/status are what they are. */
export async function explainCard(ctx: OrgContext, cardId: string): Promise<CardExplain> {
  await connectDb()

  const card = await findCardById(ctx, cardId)
  if (!card) {
    throw AppError.notFound()
  }

  const projectId = card.projectId
  const now = new Date()
  const rules = await listEnabledRulesForScope(ctx, projectId)

  const [attributes, cards, members, previousValues, latestRun] = await Promise.all([
    buildAttributeContext(ctx, { projectId, now }),
    loadPipelineCards(ctx, projectId),
    loadMembers(ctx, projectId),
    loadPreviousValues(ctx, rules, projectId),
    findLatestRunForCard(ctx, cardId),
  ])

  const pipeline = runPipeline({
    rules,
    attributes,
    cards,
    members,
    triggerEvent: SIMULATION_TRIGGER,
    ignoreTrigger: true,
    projectId,
    previousValues,
    now,
  })

  const cardContributions = pipeline.outcomes.flatMap((outcome) =>
    outcome.contributions.filter((entry) => entry.cardId === cardId),
  )
  const { explanations, conflicts, desiredState } = mergeContributions(cardContributions)
  const merged = desiredState.cards.find((entry) => entry.cardId === cardId)

  const governingRules = pipeline.outcomes.map((outcome) => {
    const own = outcome.contributions.find((entry) => entry.cardId === cardId)
    return {
      ruleId: outcome.rule.id,
      name: outcome.rule.name,
      priority: outcome.rule.priority,
      version: outcome.rule.version,
      matched: outcome.matched,
      ...(own
        ? {
            contribution: {
              ...(own.controls ? { controls: own.controls } : {}),
              ...(own.cardStatus !== undefined ? { cardStatus: own.cardStatus } : {}),
            },
          }
        : {}),
    }
  })

  const usedKeys = new Set(
    pipeline.outcomes.flatMap((outcome) => outcome.inputs.map((entry) => entry.key)),
  )
  const attributeValues = attributes.readings
    .filter((reading) => usedKeys.has(reading.key))
    .map((reading) => readingToAttributeValue(ctx, reading))

  const finalStatus = merged?.cardStatus ?? desiredStatusOf(card.status) ?? DesiredCardStatus.ACTIVE

  return {
    cardId: card.id,
    projectId: card.projectId,
    finalControls: mergeIntoControls(card.appliedControls, merged?.controls),
    finalStatus,
    governingRules,
    attributeValues,
    merge: explanations,
    conflicts: conflicts.filter((conflict) => !conflict.cardId || conflict.cardId === cardId),
    lastRuleRunId: latestRun?.id ?? null,
    lastEvaluatedAt: latestRun?.finishedAt ?? null,
  }
}
