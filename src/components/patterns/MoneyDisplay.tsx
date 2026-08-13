import { cn } from '@/lib/utils'
import { moneyDisplayText, moneySignClass } from '@/components/patterns/moneyDisplayMap'
import type { MoneyDisplayProps } from '@/components/patterns/types'

export function MoneyDisplay({ money, compact = false, colorBySign = true }: MoneyDisplayProps) {
  return (
    <span className={cn('font-medium tabular-nums', colorBySign && moneySignClass(money.amount))}>
      {moneyDisplayText(money, compact)}
    </span>
  )
}
