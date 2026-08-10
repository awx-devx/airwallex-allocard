import type { AirwallexIssuingConfig, AirwallexRequester } from '@/server/airwallex/types'
import { getRedis, redisKeys, type RedisClient } from '@/server/redis'

const CONFIG_CACHE_TTL_MS = 60 * 60 * 1000

export type ConfigApi = {
  get(): Promise<AirwallexIssuingConfig>
  /** Maximum per-transaction limit in Airwallex major units, or null if unknown. */
  getMaxLimit(currency: string): Promise<number | null>
}

export type ConfigApiDeps = {
  redis?: RedisClient
}

export function createConfigApi(client: AirwallexRequester, deps: ConfigApiDeps = {}): ConfigApi {
  async function loadCached(): Promise<AirwallexIssuingConfig> {
    const redis = deps.redis ?? getRedis()
    const key = redisKeys.awConfig(client.accountId)
    const cached = await redis.get(key)
    if (cached) {
      return JSON.parse(cached) as AirwallexIssuingConfig
    }

    const config = await client.request<AirwallexIssuingConfig>({
      method: 'GET',
      path: '/api/v1/issuing/config',
    })
    await redis.set(key, JSON.stringify(config), { px: CONFIG_CACHE_TTL_MS })
    return config
  }

  return {
    get() {
      return loadCached()
    },

    async getMaxLimit(currency) {
      const config = await loadCached()
      const entry = config.spending_limit_settings.per_transaction_limits.find(
        (row) => row.currency.toUpperCase() === currency.toUpperCase(),
      )
      return entry?.maximum ?? null
    },
  }
}
