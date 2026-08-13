import { formatMoney, formatMoneyCompact } from '@/lib/money'
import type { Money } from '@/shared/schemas/base'

export function moneySignClass(amount: number): string {
  if (amount > 0) return 'text-money-positive'
  if (amount < 0) return 'text-money-negative'
  return 'text-money-zero'
}

export function moneyDisplayText(money: Money, compact = false): string {
  return compact ? formatMoneyCompact(money) : formatMoney(money)
}
