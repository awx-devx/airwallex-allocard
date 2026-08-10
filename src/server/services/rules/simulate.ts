/**
 * Simulation — the same pipeline, stopped after step 6 (RULES-ENGINE §4).
 *
 * This file deliberately imports neither `apply` nor `record`: there is no
 * branch to get wrong. A simulation reads state and returns what a real run
 * *would* do, so its diff must equal the diff of an evaluation over the same
 * fixtures — that parity is the only reason anyone trusts a preview.
 *
 * Overrides answer "what if ROAS were 4.1?" without writing the attribute, so a
 * question about a hypothetical never becomes a fact about the org.
 */
import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { listEnabledRulesForScope } from '@/server/repositories/rules'
import { buildAttributeContext } from '@/server/services/attributes/resolve'
import { loadMembers, loadPipelineCards, loadPreviousValues } from '@/server/services/rules/load'
import { runPipeline, type PipelineResult } from '@/server/services/rules/pipeline'
import type { EventSubject } from '@/server/services/rules/targets'
import { ActorType } from '@/shared/enums/audit'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { CreateRuleInput, Rule } from '@/shared/types/rule'
import type {
  AttributeOverride,
  CardControlsDiff,
  MergeConflict,
  MergeExplanationEntry,
  RuleRun,
} from '@/shared/types/ruleRun'

/** Trigger recorded on a dry run that no domain event caused. */
export const SIMULATION_TRIGGER = 'simulate'

/** Id carried by a draft rule that exists only for the duration of the preview. */
export const DRAFT_RULE_ID = 'draft'

export type SimulateInput = {
  /** Limit to these rules; omit for every enabled rule in scope. */
  ruleIds?: string[]
  projectId?: string | null
  /** Unsaved rule body from the builder, evaluated alongside the stored ones. */
  draftRule?: CreateRuleInput
  attributeOverrides?: AttributeOverride[]
  /** Restrict to rules listening for this event; omit to ignore triggers. */
  triggerEvent?: string
  eventSubject?: EventSubject
  now?: Date
}

export type SimulateResult = {
  runs: RuleRun[]
  cardDiffs: CardControlsDiff[]
  conflicts: MergeConflict[]
  explanations: MergeExplanationEntry[]
  pipeline: PipelineResult
}

/**
 * A draft is a real rule everywhere except in the database: it merges against
 * the live rules, because a limit the builder previews in isolation is not the
 * limit the cardholder would get.
 */
function draftToRule(draft: CreateRuleInput, ctx: OrgContext, now: Date): Rule {
  const timestamp = now.toISOString()
  return {
    id: DRAFT_RULE_ID,
    orgId: ctx.orgId,
    scope: draft.scope,
    name: draft.name,
    description: draft.description ?? null,
    // Previewing a rule you have not switched on yet is the whole point.
    enabled: true,
    priority: draft.priority ?? 100,
    trigger: draft.trigger,
    when: draft.when,
    then: draft.then,
    ...(draft.else ? { else: draft.else } : {}),
    createdBy: ctx.userId,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/**
 * Dry runs keep their diagnostic status — a simulation whose whole point is to
 * reveal a missing attribute must not report `DRY_RUN` and look healthy.
 * `SUCCESS` becomes `DRY_RUN` because nothing succeeded; nothing was applied.
 */
function dryRunStatus(status: RuleRunStatus): RuleRunStatus {
  return status === RuleRunStatus.SUCCESS ? RuleRunStatus.DRY_RUN : status
}

export async function simulateRules(
  ctx: OrgContext,
  input: SimulateInput = {},
): Promise<SimulateResult> {
  await connectDb()

  const now = input.now ?? new Date()
  const startedAt = new Date()
  const projectId = input.projectId ?? input.draftRule?.scope.projectId ?? null

  const stored = await listEnabledRulesForScope(ctx, projectId)
  const selected = input.ruleIds
    ? stored.filter((rule) => input.ruleIds!.includes(rule.id))
    : stored
  const rules = input.draftRule ? [...selected, draftToRule(input.draftRule, ctx, now)] : selected

  const [attributes, cards, members, previousValues] = await Promise.all([
    buildAttributeContext(ctx, {
      projectId,
      now,
      ...(input.attributeOverrides ? { overrides: input.attributeOverrides } : {}),
    }),
    loadPipelineCards(ctx, projectId),
    loadMembers(ctx, projectId),
    // Stateful operators need the same baseline a real run would read.
    loadPreviousValues(
      ctx,
      rules.filter((rule) => rule.id !== DRAFT_RULE_ID),
      projectId,
    ),
  ])

  const pipeline = runPipeline({
    rules,
    attributes,
    cards,
    members,
    triggerEvent: input.triggerEvent ?? SIMULATION_TRIGGER,
    ...(input.triggerEvent === undefined ? { ignoreTrigger: true } : {}),
    projectId,
    ...(input.eventSubject ? { eventSubject: input.eventSubject } : {}),
    previousValues,
    now,
  })

  const finishedAt = new Date()
  const runs: RuleRun[] = pipeline.outcomes.map((outcome) => {
    const cardIds = new Set(outcome.contributions.map((entry) => entry.cardId))
    return {
      id: `dry-run:${outcome.rule.id}`,
      orgId: ctx.orgId,
      ruleId: outcome.rule.id,
      triggeredBy: ctx.userId,
      triggeredByType: ActorType.USER,
      triggerEvent: input.triggerEvent ?? SIMULATION_TRIGGER,
      inputs: outcome.inputs,
      matched: outcome.matched,
      desiredState: {
        cards: pipeline.desiredState.cards.filter((card) => cardIds.has(card.cardId)),
      },
      diff: {
        cards: pipeline.diff.cards.filter((card) => cardIds.has(card.cardId)),
      },
      actions: outcome.actions,
      conflicts: pipeline.conflicts.filter(
        (conflict) => !conflict.cardId || cardIds.has(conflict.cardId),
      ),
      status: dryRunStatus(outcome.status),
      skipReason: outcome.skipReason,
      failureReason: outcome.failureReason,
      durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    }
  })

  return {
    runs,
    cardDiffs: pipeline.diff.cards,
    conflicts: pipeline.conflicts,
    explanations: pipeline.explanations,
    pipeline,
  }
}
