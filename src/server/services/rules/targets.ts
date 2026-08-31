/**
 * Pipeline step 4 — expand targets to concrete subjects (RULES-ENGINE §3/§4). Pure.
 *
 * The caller supplies the candidate cards and members already loaded for the
 * project; this step only filters. Returned ids are always sorted so the same
 * inputs produce the same desired state every run.
 */
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import type { CardPurpose } from '@/shared/enums/cardPurpose'
import type { RuleTarget } from '@/shared/types/rule'

export type TargetCard = {
  cardId: string
  projectId: string | null
  purpose: CardPurpose
  /** User assigned via accessList (MEMBER) or the INDIVIDUAL cardholder; null for unassigned DELEGATE. */
  userId: string | null
}

export type TargetMember = {
  userId: string
  roleKey: string | null
}

export type EventSubject = {
  cardIds?: string[]
  memberIds?: string[]
}

export type TargetPool = {
  cards: readonly TargetCard[]
  members: readonly TargetMember[]
  eventSubject?: EventSubject
}

export type ResolvedTarget = {
  cardIds: string[]
  memberIds: string[]
}

function roleKeysFrom(target: RuleTarget): string[] {
  const filter = target.filter as { roleKeys?: string[]; memberRole?: string } | undefined
  const keys = [...(target.roleKeys ?? []), ...(filter?.roleKeys ?? [])]
  if (filter?.memberRole) {
    keys.push(filter.memberRole)
  }
  return keys
}

function memberIdsFrom(target: RuleTarget): string[] {
  const filter = target.filter as { memberIds?: string[] } | undefined
  return [...(target.memberIds ?? []), ...(filter?.memberIds ?? [])]
}

function usersWithRoles(pool: TargetPool, roleKeys: readonly string[]): Set<string> {
  return new Set(
    pool.members
      .filter((member) => member.roleKey !== null && roleKeys.includes(member.roleKey))
      .map((member) => member.userId),
  )
}

function sorted(ids: Iterable<string>): string[] {
  return [...new Set(ids)].sort()
}

export function resolveTarget(target: RuleTarget, pool: TargetPool): ResolvedTarget {
  const roleKeys = roleKeysFrom(target)
  const memberIds = memberIdsFrom(target)

  switch (target.select) {
    case RuleTargetSelect.CARD: {
      const cardId = target.cardId
      const exists = pool.cards.some((card) => card.cardId === cardId)
      return { cardIds: exists && cardId ? [cardId] : [], memberIds: [] }
    }

    case RuleTargetSelect.PROJECT_CARDS: {
      const filter = target.filter as { purpose?: CardPurpose; cardIds?: string[] } | undefined
      const allowedUsers = roleKeys.length > 0 ? usersWithRoles(pool, roleKeys) : null
      const cards = pool.cards.filter((card) => {
        if (filter?.purpose && card.purpose !== filter.purpose) {
          return false
        }
        if (filter?.cardIds && !filter.cardIds.includes(card.cardId)) {
          return false
        }
        if (allowedUsers && (card.userId === null || !allowedUsers.has(card.userId))) {
          return false
        }
        return true
      })
      return { cardIds: sorted(cards.map((card) => card.cardId)), memberIds: [] }
    }

    case RuleTargetSelect.MEMBER_CARDS: {
      const explicit = new Set(memberIds)
      const byRole = roleKeys.length > 0 ? usersWithRoles(pool, roleKeys) : null
      const cards = pool.cards.filter((card) => {
        if (card.userId === null) {
          return false
        }
        if (explicit.size > 0 && !explicit.has(card.userId)) {
          return false
        }
        if (byRole && !byRole.has(card.userId)) {
          return false
        }
        return true
      })
      return { cardIds: sorted(cards.map((card) => card.cardId)), memberIds: [] }
    }

    case RuleTargetSelect.PROJECT_MEMBERS: {
      const explicit = new Set(memberIds)
      const byRole = roleKeys.length > 0 ? usersWithRoles(pool, roleKeys) : null
      const members = pool.members.filter((member) => {
        if (explicit.size > 0 && !explicit.has(member.userId)) {
          return false
        }
        if (byRole && !byRole.has(member.userId)) {
          return false
        }
        return true
      })
      return { cardIds: [], memberIds: sorted(members.map((member) => member.userId)) }
    }

    case RuleTargetSelect.EVENT_SUBJECT: {
      return {
        cardIds: sorted(pool.eventSubject?.cardIds ?? []),
        memberIds: sorted(pool.eventSubject?.memberIds ?? []),
      }
    }
  }
}
