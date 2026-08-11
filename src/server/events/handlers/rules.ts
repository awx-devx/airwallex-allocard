/**
 * Domain events → rule evaluation (ARCHITECTURE §8 path 1).
 * The worker debounces; this handler is what actually runs the pipeline.
 */
import type { DomainEvent } from '@/server/events/types'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import type { ApplyDeps } from '@/server/services/rules/apply'
import type { EventSubject } from '@/server/services/rules/targets'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'

/** Events that must not re-enter the engine (would loop). */
const SKIP_TYPES = new Set<string>([DomainEventType.RULE_EVALUATED, DomainEventType.SCHEDULE_TICK])

function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: 'system', orgRole: OrgRole.OWNER }
}

function eventSubjectOf(event: DomainEvent): EventSubject | undefined {
  if (event.subjectType === 'card') {
    return { cardIds: [event.subjectId] }
  }
  if (event.subjectType === 'member' || event.subjectType === 'user') {
    return { memberIds: [event.subjectId] }
  }
  return undefined
}

/**
 * Evaluate every enabled rule that listens for this event, scoped to the
 * event's project when present. Failures are recorded per-rule inside
 * `evaluateAndApply` — this function does not swallow them.
 */
export async function handleDomainEventForRules(
  event: DomainEvent,
  deps: ApplyDeps = {},
): Promise<void> {
  if (SKIP_TYPES.has(event.type)) {
    return
  }
  if (event.orgId.startsWith('_')) {
    // Internal wake / shutdown markers on the stream.
    return
  }

  const subject = eventSubjectOf(event)
  await evaluateAndApply(
    systemCtx(event.orgId),
    {
      triggerEvent: event.type,
      projectId: event.projectId ?? null,
      ...(subject ? { eventSubject: subject } : {}),
      triggeredBy: 'system',
      triggeredByType: ActorType.SYSTEM,
    },
    deps,
  )
}
