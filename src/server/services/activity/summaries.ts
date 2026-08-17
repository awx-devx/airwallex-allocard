import { formatMoney } from '@/lib/money'

/** Reveal is audited as pan_token; the feed must not surface that name. */
const CARD_DETAILS_REVEALED = 'Card details revealed'

export function purchaseRequestFeedSummary(
  status: string,
  vendor: string,
  amount: number,
  currency: string,
): string {
  return `Purchase request ${status}: ${vendor} ${formatMoney({ amount, currency })}`
}

export function transactionFeedSummary(
  type: string,
  status: string,
  amount: number,
  currency: string,
  merchantName: string,
): string {
  return `${type} ${status} ${formatMoney({ amount, currency })} at ${merchantName}`
}

export function auditActionFeedSummary(action: string): string {
  if (action === 'card.pan_token_created') {
    return CARD_DETAILS_REVEALED
  }
  const parts = action.split(/[._]/).filter((part) => part.length > 0)
  if (parts.length === 0) {
    return action
  }
  return parts
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index === 0) {
        return lower.charAt(0).toUpperCase() + lower.slice(1)
      }
      return lower
    })
    .join(' ')
}
