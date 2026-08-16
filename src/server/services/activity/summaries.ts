import { formatMoney } from '@/lib/money'

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
