import type {
  AirwallexCardholder,
  AirwallexRequester,
  CreateCardholderBody,
  UpdateCardholderBody,
} from '@/server/airwallex/types'

export type CardholdersApi = {
  create(body: CreateCardholderBody): Promise<AirwallexCardholder>
  get(cardholderId: string): Promise<AirwallexCardholder>
  update(cardholderId: string, body: UpdateCardholderBody): Promise<AirwallexCardholder>
}

export function createCardholdersApi(client: AirwallexRequester): CardholdersApi {
  return {
    create(body) {
      return client.request<AirwallexCardholder>({
        method: 'POST',
        path: '/api/v1/issuing/cardholders/create',
        body,
        requestId: body.request_id,
      })
    },

    get(cardholderId) {
      return client.request<AirwallexCardholder>({
        method: 'GET',
        path: `/api/v1/issuing/cardholders/${cardholderId}`,
      })
    },

    update(cardholderId, body) {
      return client.request<AirwallexCardholder>({
        method: 'POST',
        path: `/api/v1/issuing/cardholders/${cardholderId}/update`,
        body,
      })
    },
  }
}
