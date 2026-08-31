import type { OrgContext } from '@/server/http/types'
import type { RequirePermissionSubject } from '@/server/http/requirePermission'
import { cardPermissionUserId } from '@/shared/cardHolder'
import type { Card } from '@/shared/types/card'

export function permissionSubjectForCard(ctx: OrgContext, card: Card): RequirePermissionSubject {
  return {
    projectId: card.projectId ?? undefined,
    cardId: card.id,
    userId: cardPermissionUserId(card, ctx.userId),
  }
}
