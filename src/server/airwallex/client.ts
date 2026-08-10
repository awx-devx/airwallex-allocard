import type { ServerEnv } from '@/server/env'
import type { AuthDeps } from '@/server/airwallex/auth'
import {
  airwallexRequest,
  type AirwallexRequestOptions,
  type HttpDeps,
} from '@/server/airwallex/http'
import type { RedisClient } from '@/server/redis'

export type AirwallexClientDeps = HttpDeps & {
  env?: ServerEnv
  redis?: RedisClient
}

/**
 * Account-scoped Airwallex client. Demo always uses `forAccount(null)`
 * (single-account tenancy). Domain namespaces are attached in B5.3.
 *
 * Never exposes GET /issuing/cards/{id}/details (PCI).
 */
export type AirwallexClient = {
  readonly accountId: string | null
  forAccount(accountId: string | null): AirwallexClient
  request<T>(opts: Omit<AirwallexRequestOptions, 'accountId'>): Promise<T>
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

  const client: AirwallexClient = {
    accountId,
    forAccount(nextAccountId: string | null) {
      return createAirwallexClient(nextAccountId, deps)
    },
    request<T>(opts: Omit<AirwallexRequestOptions, 'accountId'>) {
      return airwallexRequest<T>({ ...opts, accountId }, resolvedDeps)
    },
  }

  return client
}

/** Default client for single-account demo mode. */
export function getAirwallexClient(deps: AirwallexClientDeps = {}): AirwallexClient {
  return createAirwallexClient(null, deps)
}
