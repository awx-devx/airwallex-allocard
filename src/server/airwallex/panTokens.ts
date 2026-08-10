import type {
  AirwallexPanToken,
  AirwallexRequester,
  CreatePanTokenBody,
} from '@/server/airwallex/types'

/**
 * PAN token for Airwallex secure iframe. Never call GET .../details.
 * Response must never include PAN/CVV/expiry.
 */
export type PanTokensApi = {
  create(body: CreatePanTokenBody): Promise<AirwallexPanToken>
}

export function createPanTokensApi(client: AirwallexRequester): PanTokensApi {
  return {
    create(body) {
      return client.request<AirwallexPanToken>({
        method: 'POST',
        path: '/api/v1/issuing/pantokens/create',
        body,
      })
    },
  }
}
