/**
 * Escalation sweep — find PENDING requests past their SLA and route onward once.
 * Genuinely time-triggered (ARCHITECTURE §8); idempotent via markEscalated.
 */
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { listApplicableApprovalRules } from '@/server/repositories/approvalRules'
import { listOverdueForEscalation, markEscalated } from '@/server/repositories/purchaseRequests'
import { audit } from '@/server/services/audit/log'
import { ActorType } from '@/shared/enums/audit'
import { OrgRole } from '@/shared/enums/orgRole'
import type { ApprovalRule } from '@/shared/types/approvalRule'
import type { PurchaseRequest } from '@/shared/types/purchaseRequest'

function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: 'system', orgRole: OrgRole.OWNER }
}

export type EscalateApprovalsResult = {
  scanned: number
  escalated: number
}

/**
 * Pick the highest matching approval rule for the request amount
 * (same threshold logic as policy). Fallback: first applicable rule.
 */
function ruleForRequest(
  request: PurchaseRequest,
  rules: readonly ApprovalRule[],
): ApprovalRule | null {
  const matching = rules
    .filter((rule) => request.amount >= rule.threshold)
    .sort((a, b) => b.threshold - a.threshold)
  return matching[0] ?? rules[0] ?? null
}

function isPastSla(request: PurchaseRequest, rule: ApprovalRule, now: Date): boolean {
  const anchor = new Date(request.updatedAt).getTime()
  const deadline = anchor + rule.escalationAfterMins * 60_000
  return now.getTime() >= deadline
}

/**
 * Cross-tenant sweep: PENDING + escalatedAt null, past escalationAfterMins.
 * Emits `request.escalated` at most once per request (markEscalated is conditional).
 */
export async function escalateApprovals(now: Date = new Date()): Promise<EscalateApprovalsResult> {
  await connectDb()

  const candidates = await listOverdueForEscalation()
  let escalated = 0

  for (const request of candidates) {
    if (request.escalatedAt !== null) {
      continue
    }

    const ctx = systemCtx(request.orgId)
    const rules = await listApplicableApprovalRules(ctx, request.projectId)
    const rule = ruleForRequest(request, rules)
    if (!rule) {
      continue
    }
    if (!isPastSla(request, rule, now)) {
      continue
    }

    const marked = await markEscalated(ctx, request.id, now)
    if (!marked) {
      // Concurrent sweep already escalated — idempotent no-op.
      continue
    }

    await publishEvent({
      type: DomainEventType.REQUEST_ESCALATED,
      orgId: request.orgId,
      projectId: request.projectId,
      subjectType: 'purchaseRequest',
      subjectId: request.id,
      payload: {
        requestId: request.id,
        projectId: request.projectId,
        escalateTo: rule.escalateTo,
        escalationAfterMins: rule.escalationAfterMins,
      },
    })

    await audit(ctx, {
      action: 'request.escalated',
      subjectType: 'purchaseRequest',
      subjectId: request.id,
      projectId: request.projectId,
      actorType: ActorType.SYSTEM,
      actorId: 'system',
      before: request,
      after: marked,
      metadata: { escalateTo: rule.escalateTo },
    })

    escalated += 1
  }

  return { scanned: candidates.length, escalated }
}
