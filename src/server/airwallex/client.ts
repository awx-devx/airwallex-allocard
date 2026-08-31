import type { ServerEnv } from '@/server/env'
import type { AuthDeps } from '@/server/airwallex/auth'
import { createCardholdersApi, type CardholdersApi } from '@/server/airwallex/cardholders'
import { createCardsApi, type CardsApi } from '@/server/airwallex/cards'
import { createConfigApi, type ConfigApi } from '@/server/airwallex/config'
import {
  airwallexRequest,
  type AirwallexRequestOptions,
  type HttpDeps,
} from '@/server/airwallex/http'
import { createPanTokensApi, type PanTokensApi } from '@/server/airwallex/panTokens'
import { createTransactionsApi, type TransactionsApi } from '@/server/airwallex/transactions'
import type { AirwallexRequester } from '@/server/airwallex/types'
import type { RedisClient } from '@/server/redis'

export type AirwallexClientDeps = HttpDeps & {
  env?: ServerEnv
  redis?: RedisClient
}

/**
 * Account-scoped Airwallex client. Demo always uses `forAccount(null)`
 * (single-account tenancy).
 *
 * GET /issuing/cards/{id}/details is organisation-card reveal only.
 * Never persist, log, or audit PAN/CVV/expiry.
 */
export type AirwallexClient = AirwallexRequester & {
  forAccount(accountId: string | null): AirwallexClient
  cardholders: CardholdersApi
  cards: CardsApi
  transactions: TransactionsApi
  config: ConfigApi
  panTokens: PanTokensApi
}

function resolveDeps(deps: AirwallexClientDeps): AuthDeps & HttpDeps {
  const useFixtures =
    deps.useFixtures ??
    deps.env?.AIRWALLEX_USE_FIXTURES ??
    (process.env.VITEST === 'true' ? true : undefined)

  return {
    ...deps,
    useFixtures,
  }
}

export function createAirwallexClient(
  accountId: string | null = null,
  deps: AirwallexClientDeps = {},
): AirwallexClient {
  const resolvedDeps = resolveDeps(deps)

  const requester: AirwallexRequester = {
    accountId,
    request<T>(opts: Omit<AirwallexRequestOptions, 'accountId'>) {
      return airwallexRequest<T>({ ...opts, accountId }, resolvedDeps)
    },
  }

  return {
    ...requester,
    forAccount(nextAccountId: string | null) {
      return createAirwallexClient(nextAccountId, deps)
    },
    cardholders: createCardholdersApi(requester),
    cards: createCardsApi(requester),
    transactions: createTransactionsApi(requester),
    config: createConfigApi(requester, { redis: deps.redis }),
    panTokens: createPanTokensApi(requester),
  }
}

/** Default client for single-account demo mode. */
export function getAirwallexClient(deps: AirwallexClientDeps = {}): AirwallexClient {
  return createAirwallexClient(null, deps)
}
