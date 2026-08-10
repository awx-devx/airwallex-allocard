import type { OrgContext } from '@/server/http/types'

/**
 * Funding seam for connected-account migration (AIRWALLEX-INTEGRATION §9).
 * Demo uses a single shared wallet — resolve returns no funding_source_id.
 */
export interface FundingSource {
  resolve(ctx: OrgContext): Promise<{ fundingSourceId?: string }>
  availableBalance(ctx: OrgContext, currency: string): Promise<number>
}

/**
 * Single-wallet implementation for D1 single-account mode.
 * `availableBalance` stubs 0 until B8 wires balances.
 */
export class SingleWalletFundingSource implements FundingSource {
  async resolve(_ctx: OrgContext): Promise<{ fundingSourceId?: string }> {
    void _ctx
    return {}
  }

  async availableBalance(_ctx: OrgContext, _currency: string): Promise<number> {
    void _ctx
    void _currency
    // TODO(B8): read GET /balances/current
    return 0
  }
}

export const defaultFundingSource: FundingSource = new SingleWalletFundingSource()
