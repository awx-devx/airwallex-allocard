/**
 * Worker backstop: poll PENDING cardholders until Airwallex screening is READY,
 * then re-evaluate launch issuance so SKIPPED card.create completes.
 * Also finishes local PENDING card stubs (attach or idempotent create).
 */
import { connectDb } from '@/server/db/connect'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { listAllOrganizations } from '@/server/repositories/organizations'
import { listCardholders } from '@/server/repositories/cardholders'
import { listCards } from '@/server/repositories/cards'
import { listActiveProjectMembersForUser } from '@/server/repositories/projectMembers'
import { findProjectById, listProjects } from '@/server/repositories/projects'
import { refreshCardholder, type EnsureCardholderDeps } from '@/server/services/cardholders/ensure'
import { completePendingCard, isProvisionalAirwallexId } from '@/server/services/cards/create'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { ActorType } from '@/shared/enums/audit'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardStatus } from '@/shared/enums/cardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { Card } from '@/shared/types/card'
import type { Cardholder } from '@/shared/types/cardholder'

function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: 'system', orgRole: OrgRole.OWNER }
}

export type RefreshPendingCardholdersResult = {
  orgsVisited: number
  refreshed: number
  becameReady: number
  evaluations: number
  pendingCards: number
  cardsCompleted: number
}

async function listAllPending(ctx: OrgContext): Promise<Cardholder[]> {
  const items: Cardholder[] = []
  let page = 1
  let total = Infinity
  while ((page - 1) * 100 < total) {
    const batch = await listCardholders(ctx, {
      status: CardholderStatus.PENDING,
      page,
      pageSize: 100,
    })
    total = batch.total
    items.push(...batch.items)
    page += 1
    if (batch.items.length === 0) {
      break
    }
  }
  return items
}

async function listAllPendingCards(ctx: OrgContext): Promise<Card[]> {
  const items: Card[] = []
  let page = 1
  let total = Infinity
  while ((page - 1) * 100 < total) {
    const batch = await listCards(ctx, {
      status: CardStatus.PENDING,
      page,
      pageSize: 100,
    })
    total = batch.total
    items.push(...batch.items)
    page += 1
    if (batch.items.length === 0) {
      break
    }
  }
  return items
}

export async function refreshPendingCardholders(
  deps: EnsureCardholderDeps = {},
): Promise<RefreshPendingCardholdersResult> {
  await connectDb()
  const orgs = await listAllOrganizations()
  let refreshed = 0
  let becameReady = 0
  let evaluations = 0
  let pendingCards = 0
  let cardsCompleted = 0

  for (const org of orgs) {
    const ctx = systemCtx(org.id)
    const pending = await listAllPending(ctx)
    const readyProjectIds = new Set<string>()

    for (const cardholder of pending) {
      const updated = await refreshCardholder(ctx, cardholder, deps)
      refreshed += 1
      if (updated.status !== CardholderStatus.READY) {
        continue
      }
      becameReady += 1
      if (updated.userId) {
        const memberships = await listActiveProjectMembersForUser(ctx, updated.userId)
        for (const membership of memberships) {
          readyProjectIds.add(membership.projectId)
        }
      } else {
        const active = await listProjects(ctx, {
          status: ProjectStatus.ACTIVE,
          page: 1,
          pageSize: 100,
        })
        for (const project of active.items) {
          readyProjectIds.add(project.id)
        }
      }
    }

    for (const projectId of readyProjectIds) {
      const project = await findProjectById(ctx, projectId)
      if (project?.status !== ProjectStatus.ACTIVE) {
        continue
      }
      await evaluateAndApply(
        ctx,
        {
          triggerEvent: DomainEventType.PROJECT_LAUNCHED,
          projectId,
          triggeredBy: 'system',
          triggeredByType: ActorType.SYSTEM,
        },
        deps,
      )
      evaluations += 1
    }

    const stubs = await listAllPendingCards(ctx)
    for (const stub of stubs) {
      if (!isProvisionalAirwallexId(stub.airwallexCardId)) {
        continue
      }
      pendingCards += 1
      const completed = await completePendingCard(ctx, stub, deps)
      if (!isProvisionalAirwallexId(completed.airwallexCardId)) {
        cardsCompleted += 1
      }
    }
  }

  return {
    orgsVisited: orgs.length,
    refreshed,
    becameReady,
    evaluations,
    pendingCards,
    cardsCompleted,
  }
}
