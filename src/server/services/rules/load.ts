/**
 * Loading state for the pipeline. Reads only — nothing here writes.
 *
 * Simulation and a real evaluation share these loaders on purpose: a dry run is
 * only useful if it saw exactly what the real run would have seen.
 */
import type { OrgContext } from '@/server/http/types'
import { listCards } from '@/server/repositories/cards'
import { findCardholderById } from '@/server/repositories/cardholders'
import { listActiveProjectMembers } from '@/server/repositories/projectMembers'
import { listRoles } from '@/server/repositories/roles'
import { findLastRuleRun } from '@/server/repositories/ruleRuns'
import { previousValuesFrom } from '@/server/services/rules/record'
import type { PipelineCard } from '@/server/services/rules/pipeline'
import type { TargetMember } from '@/server/services/rules/targets'
import { cardHolderUserId } from '@/shared/cardHolder'
import { CardStatus } from '@/shared/enums/cardStatus'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { Rule } from '@/shared/types/rule'

/** Cards only carry a desired status once they are past PENDING. */
export function desiredStatusOf(status: CardStatus): DesiredCardStatus | null {
  switch (status) {
    case CardStatus.ACTIVE:
      return DesiredCardStatus.ACTIVE
    case CardStatus.INACTIVE:
      return DesiredCardStatus.INACTIVE
    case CardStatus.CLOSED:
      return DesiredCardStatus.CLOSED
    default:
      return null
  }
}

export async function loadPipelineCards(
  ctx: OrgContext,
  projectId: string | null | undefined,
): Promise<PipelineCard[]> {
  const page = await listCards(ctx, {
    ...(projectId ? { projectId } : {}),
    pageSize: 100,
  })

  const cardholderIds = [...new Set(page.items.map((card) => card.cardholderId))]
  const cardholders = await Promise.all(cardholderIds.map((id) => findCardholderById(ctx, id)))
  const userIdByCardholder = new Map(
    cardholders.filter((entry) => entry !== null).map((entry) => [entry.id, entry.userId]),
  )

  return page.items.map((card) => ({
    cardId: card.id,
    projectId: card.projectId,
    purpose: card.purpose,
    userId: cardHolderUserId(card) ?? userIdByCardholder.get(card.cardholderId) ?? null,
    controls: card.appliedControls,
    cardStatus: desiredStatusOf(card.status),
  }))
}

export async function loadMembers(
  ctx: OrgContext,
  projectId: string | null | undefined,
): Promise<TargetMember[]> {
  if (!projectId) {
    return []
  }
  const [members, roles] = await Promise.all([
    listActiveProjectMembers(ctx, projectId),
    listRoles(ctx),
  ])
  const roleKeyById = new Map(roles.map((role) => [role.id, role.key]))
  return members.map((member) => ({
    userId: member.userId,
    roleKey: roleKeyById.get(member.roleId) ?? null,
  }))
}

/** Last recorded values per rule, so crossedAbove / crossedBelow have a baseline. */
export async function loadPreviousValues(
  ctx: OrgContext,
  rules: readonly Rule[],
  projectId: string | null | undefined,
): Promise<Map<string, Map<string, AttributeLiteral>>> {
  const entries = await Promise.all(
    rules.map(async (rule) => {
      const previous = await findLastRuleRun(ctx, rule.id, { projectId })
      return [rule.id, previous ? previousValuesFrom(previous) : new Map()] as const
    }),
  )
  return new Map(entries)
}
