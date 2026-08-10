import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { findCardById, listCards, type ListCardsFilter } from '@/server/repositories/cards'
import { projectIdsGrantingPermission } from '@/server/http/requirePermission'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { CardStatus } from '@/shared/enums/cardStatus'
import type { Card, CardList } from '@/shared/types/card'

export type ListCardsDeps = {
  airwallex?: AirwallexClient
}

function isElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

export async function listCardsForOrg(
  ctx: OrgContext,
  filter: ListCardsFilter = {},
): Promise<CardList> {
  await connectDb()

  if (isElevated(ctx.orgRole)) {
    return listCards(ctx, filter)
  }

  const projectIds = await projectIdsGrantingPermission(ctx, Permission.CARD_VIEW)
  if (projectIds.length === 0) {
    throw AppError.permissionDenied(Permission.CARD_VIEW)
  }

  // If a specific project filter is set, it must be allowed.
  if (filter.projectId !== undefined) {
    if (!projectIds.includes(filter.projectId)) {
      throw AppError.permissionDenied(Permission.CARD_VIEW)
    }
    return listCards(ctx, filter)
  }

  // Union across allowed projects (simple approach: fetch each page's worth per project).
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 20
  const all: Card[] = []
  for (const projectId of projectIds) {
    const chunk = await listCards(ctx, {
      ...filter,
      projectId,
      page: 1,
      pageSize: 100,
    })
    all.push(...chunk.items)
  }

  all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const total = all.length
  const start = (page - 1) * pageSize
  return {
    items: all.slice(start, start + pageSize),
    page,
    pageSize,
    total,
  }
}

export async function listCardsForProject(
  ctx: OrgContext,
  projectId: string,
  filter: Omit<ListCardsFilter, 'projectId'> = {},
): Promise<CardList> {
  await connectDb()
  return listCards(ctx, { ...filter, projectId })
}

export async function getCardForOrg(
  ctx: OrgContext,
  cardId: string,
  deps: ListCardsDeps = {},
): Promise<Card> {
  await connectDb()
  const card = await findCardById(ctx, cardId)
  if (!card) {
    throw AppError.notFound()
  }

  // Optionally refresh status from Airwallex (never details).
  if (!card.airwallexCardId.startsWith('pending:')) {
    try {
      const client = deps.airwallex ?? getAirwallexClient()
      const aw = await client.cards.get(card.airwallexCardId)
      if (aw.card_status && aw.card_status !== card.status) {
        const { updateCardStatus } = await import('@/server/repositories/cards')
        const updated = await updateCardStatus(ctx, cardId, aw.card_status as CardStatus)
        if (updated) {
          return updated
        }
      }
    } catch {
      // Local mirror is authoritative if refresh fails.
    }
  }

  return card
}
