/**
 * Full evaluation: load state, run the pure pipeline (steps 1–6), apply (7),
 * record (8). This is the only entry point that writes.
 *
 * Every rule is applied and recorded independently — a rule that fails is
 * recorded `FAILED` and the rest of the engine carries on (RULES-ENGINE §4).
 */
import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { listEnabledRulesForScope } from '@/server/repositories/rules'
import { buildAttributeContext } from '@/server/services/attributes/resolve'
import { applyCard, type ApplyDeps } from '@/server/services/rules/apply'
import { loadMembers, loadPipelineCards, loadPreviousValues } from '@/server/services/rules/load'
import { recordRuleRun } from '@/server/services/rules/record'
import { runPipeline, type PipelineResult } from '@/server/services/rules/pipeline'
import type { EventSubject } from '@/server/services/rules/targets'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { ActorType } from '@/shared/enums/audit'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { ActionResult, RuleRun } from '@/shared/types/ruleRun'

export type EvaluateAndApplyInput = {
  triggerEvent: string
  projectId?: string | null
  eventSubject?: EventSubject
  triggeredBy?: string
  triggeredByType?: ActorType
  /** Restrict evaluation to these rules; omit for every enabled rule in scope. */
  ruleIds?: string[]
  now?: Date
}

export type EvaluateAndApplyResult = {
  runs: RuleRun[]
  pipeline: PipelineResult
}

/** Run the engine for one subject and persist everything it decided. */
export async function evaluateAndApply(
  ctx: OrgContext,
  input: EvaluateAndApplyInput,
  deps: ApplyDeps = {},
): Promise<EvaluateAndApplyResult> {
  await connectDb()

  const now = input.now ?? new Date()
  const startedAt = now
  const projectId = input.projectId ?? null

  const allRules = await listEnabledRulesForScope(ctx, projectId)
  const rules = input.ruleIds
    ? allRules.filter((rule) => input.ruleIds!.includes(rule.id))
    : allRules

  const [attributes, cards, members, previousValues] = await Promise.all([
    buildAttributeContext(ctx, { projectId, now }),
    loadPipelineCards(ctx, projectId),
    loadMembers(ctx, projectId),
    loadPreviousValues(ctx, rules, projectId),
  ])

  const pipeline = runPipeline({
    rules,
    attributes,
    cards,
    members,
    triggerEvent: input.triggerEvent,
    projectId,
    ...(input.eventSubject ? { eventSubject: input.eventSubject } : {}),
    previousValues,
    now,
  })

  const attributeValues = new Map<string, AttributeLiteral>()
  for (const reading of attributes.readings) {
    if (!attributeValues.has(reading.key)) {
      attributeValues.set(reading.key, reading.value)
    }
  }

  // Apply once per card, not once per rule — the merged desired state is what
  // reality should match. Conflicted cards are deliberately not pushed.
  const conflictedCards = new Set(
    pipeline.conflicts.map((conflict) => conflict.cardId).filter(Boolean),
  )
  const changedCards = new Set(
    pipeline.diff.cards.filter((card) => card.changed).map((card) => card.cardId),
  )

  const applied = new Map<string, ActionResultStatus>()
  const appliedMessages = new Map<string, string | null>()

  for (const desired of pipeline.desiredState.cards) {
    if (!changedCards.has(desired.cardId)) {
      applied.set(desired.cardId, ActionResultStatus.SKIPPED)
      appliedMessages.set(desired.cardId, 'Already matches desired state')
      continue
    }
    if (conflictedCards.has(desired.cardId)) {
      applied.set(desired.cardId, ActionResultStatus.CONFLICT)
      appliedMessages.set(desired.cardId, 'Merge conflict; nothing pushed')
      continue
    }
    const outcome = await applyCard(ctx, desired, { attributeValues, now }, deps)
    applied.set(desired.cardId, outcome.status)
    appliedMessages.set(desired.cardId, outcome.message)
  }

  const runs: RuleRun[] = []
  for (const outcome of pipeline.outcomes) {
    const actions: ActionResult[] = outcome.actions.map((action) => {
      if (action.status !== ActionResultStatus.WOULD_APPLY || action.targetId === null) {
        return action
      }
      const status = applied.get(action.targetId)
      if (status === undefined) {
        return action
      }
      return { ...action, status, message: appliedMessages.get(action.targetId) ?? null }
    })

    const cardIds = new Set(outcome.contributions.map((entry) => entry.cardId))
    const status =
      outcome.status === RuleRunStatus.SUCCESS &&
      actions.some((action) => action.status === ActionResultStatus.FAILED)
        ? RuleRunStatus.PARTIAL
        : outcome.status

    runs.push(
      await recordRuleRun(ctx, {
        ruleId: outcome.rule.id,
        triggeredBy: input.triggeredBy ?? 'system',
        triggeredByType: input.triggeredByType ?? ActorType.SYSTEM,
        triggerEvent: input.triggerEvent,
        inputs: outcome.inputs,
        matched: outcome.matched,
        desiredState: {
          cards: pipeline.desiredState.cards.filter((card) => cardIds.has(card.cardId)),
        },
        diff: {
          cards: pipeline.diff.cards.filter((card) => cardIds.has(card.cardId)),
        },
        actions,
        conflicts: pipeline.conflicts.filter(
          (conflict) => !conflict.cardId || cardIds.has(conflict.cardId),
        ),
        status,
        skipReason: outcome.skipReason,
        failureReason: outcome.failureReason,
        startedAt,
        finishedAt: new Date(),
        projectId,
      }),
    )
  }

  return { runs, pipeline }
}
