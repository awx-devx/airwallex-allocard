/**
 * Pipeline step 8 — record the run (RULES-ENGINE §4).
 *
 * A run is the answer to "why is my limit $400?", so it records the inputs it
 * consumed, whether the conditions matched, the state it produced, and what
 * changed — enough to reconstruct the decision without re-running it.
 */
import { publishEvent } from '@/server/events/bus'
import { DomainEventType, type RuleEvaluatedPayload } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { createRuleRun } from '@/server/repositories/ruleRuns'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type {
  ActionResult,
  DesiredState,
  MergeConflict,
  RuleRun,
  RuleRunDiff,
  RuleRunInputValue,
} from '@/shared/types/ruleRun'

export type RecordRunInput = {
  ruleId: string
  triggeredBy: string
  triggeredByType?: ActorType
  triggerEvent: string
  inputs: RuleRunInputValue[]
  matched: boolean
  desiredState: DesiredState
  diff: RuleRunDiff
  actions: ActionResult[]
  conflicts: MergeConflict[]
  status: RuleRunStatus
  skipReason?: string | null
  failureReason?: string | null
  startedAt: Date
  finishedAt: Date
  projectId?: string | null
}

/** Values this run observed, keyed for the next run's crossedAbove / crossedBelow. */
export function previousValuesFrom(run: Pick<RuleRun, 'inputs'>): Map<string, AttributeLiteral> {
  return new Map(run.inputs.map((entry) => [entry.key, entry.value]))
}

export async function recordRuleRun(ctx: OrgContext, input: RecordRunInput): Promise<RuleRun> {
  const run = await createRuleRun(ctx, {
    ruleId: input.ruleId,
    triggeredBy: input.triggeredBy,
    triggeredByType: input.triggeredByType ?? ActorType.SYSTEM,
    triggerEvent: input.triggerEvent,
    inputs: input.inputs,
    matched: input.matched,
    desiredState: input.desiredState,
    diff: input.diff,
    actions: input.actions,
    conflicts: input.conflicts,
    status: input.status,
    skipReason: input.skipReason ?? null,
    failureReason: input.failureReason ?? null,
    durationMs: Math.max(0, input.finishedAt.getTime() - input.startedAt.getTime()),
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    projectId: input.projectId ?? null,
  })

  const changedCardIds = input.diff.cards.filter((card) => card.changed).map((card) => card.cardId)

  await publishEvent<typeof DomainEventType.RULE_EVALUATED, RuleEvaluatedPayload>({
    type: DomainEventType.RULE_EVALUATED,
    orgId: ctx.orgId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    subjectType: 'rule',
    subjectId: input.ruleId,
    payload: {
      ruleRunId: run.id,
      ruleId: input.ruleId,
      projectId: input.projectId ?? null,
      status: input.status,
      matched: input.matched,
      changedCardIds,
    },
  })

  // One audit entry per mutating run. A run that changed nothing is history,
  // not a mutation, so it is recorded as a RuleRun without an audit entry.
  if (changedCardIds.length > 0) {
    await audit(ctx, {
      action: 'rule.applied',
      subjectType: 'rule',
      subjectId: input.ruleId,
      actorType: ActorType.RULE,
      actorId: input.ruleId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      after: { ruleRunId: run.id, changedCardIds },
      metadata: { triggerEvent: input.triggerEvent, status: input.status },
    })
  }

  return run
}
