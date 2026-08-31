import type { OrgContext } from '@/server/http/types'
import type {
  AirwallexCard,
  AirwallexCardDetails,
  AirwallexCardLimits,
  AirwallexCardListResponse,
  AirwallexRequester,
  CreateCardBody,
  UpdateCardBody,
} from '@/server/airwallex/types'

export type ListCardsFilter = {
  pageNum?: number
  pageSize?: number
  cardStatus?: string
  projectId?: string
}

export type CardsApi = {
  create(body: CreateCardBody): Promise<AirwallexCard>
  get(cardId: string): Promise<AirwallexCard>
  /**
   * Org-scoped list — always filters `metadata.orgId === ctx.orgId`.
   * There is no unfiltered request-path list; see `listAllTenantsUnsafe`.
   */
  list(ctx: OrgContext, filter?: ListCardsFilter): Promise<AirwallexCardListResponse>
  /** Escape hatch for reconciliation jobs only — never call from request paths. */
  listAllTenantsUnsafe(filter?: ListCardsFilter): Promise<AirwallexCardListResponse>
  update(cardId: string, body: UpdateCardBody): Promise<AirwallexCard>
  limits(cardId: string): Promise<AirwallexCardLimits>
  activate(cardId: string): Promise<AirwallexCard>
  /**
   * Sensitive details for organisation cards only. Never persist the result.
   * Do not call for `issue_to: INDIVIDUAL` (PCI).
   */
  details(cardId: string): Promise<AirwallexCardDetails>
}

function buildListQuery(filter?: ListCardsFilter): Record<string, string | undefined> {
  return {
    page_num: filter?.pageNum !== undefined ? String(filter.pageNum) : undefined,
    page_size: filter?.pageSize !== undefined ? String(filter.pageSize) : undefined,
    card_status: filter?.cardStatus,
  }
}

function filterByOrg(
  response: AirwallexCardListResponse,
  orgId: string,
  projectId?: string,
): AirwallexCardListResponse {
  const items = response.items.filter((card) => {
    if (card.metadata?.orgId !== orgId) {
      return false
    }
    if (projectId !== undefined && card.metadata?.projectId !== projectId) {
      return false
    }
    return true
  })
  return { has_more: response.has_more, items }
}

export function createCardsApi(client: AirwallexRequester): CardsApi {
  async function listRaw(filter?: ListCardsFilter): Promise<AirwallexCardListResponse> {
    return client.request<AirwallexCardListResponse>({
      method: 'GET',
      path: '/api/v1/issuing/cards',
      query: buildListQuery(filter),
    })
  }

  return {
    create(body) {
      if (!body.metadata.orgId) {
        throw new Error('Airwallex card create requires metadata.orgId')
      }
      if (!body.metadata.cardDocId) {
        throw new Error('Airwallex card create requires metadata.cardDocId')
      }
      return client.request<AirwallexCard>({
        method: 'POST',
        path: '/api/v1/issuing/cards/create',
        body,
        requestId: body.request_id,
      })
    },

    get(cardId) {
      return client.request<AirwallexCard>({
        method: 'GET',
        path: `/api/v1/issuing/cards/${cardId}`,
      })
    },

    async list(ctx, filter) {
      const raw = await listRaw(filter)
      return filterByOrg(raw, ctx.orgId, filter?.projectId)
    },

    listAllTenantsUnsafe(filter) {
      return listRaw(filter)
    },

    update(cardId, body) {
      return client.request<AirwallexCard>({
        method: 'POST',
        path: `/api/v1/issuing/cards/${cardId}/update`,
        body,
      })
    },

    limits(cardId) {
      return client.request<AirwallexCardLimits>({
        method: 'GET',
        path: `/api/v1/issuing/cards/${cardId}/limits`,
      })
    },

    activate(cardId) {
      return client.request<AirwallexCard>({
        method: 'POST',
        path: `/api/v1/issuing/cards/${cardId}/activate`,
        body: {},
      })
    },

    details(cardId) {
      return client.request<AirwallexCardDetails>({
        method: 'GET',
        path: `/api/v1/issuing/cards/${cardId}/details`,
      })
    },
  }
}
