import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { humaniseInterval, limitMeterLayout } from '@/components/patterns/limitMeterLayout'
import type { LimitMeterProps } from '@/components/patterns/types'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export function LimitMeter({ interval, amount, remaining, currency }: LimitMeterProps) {
  const layout = limitMeterLayout({ amount, remaining })
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span>{humaniseInterval(interval)}</span>
        <span>
          <MoneyDisplay money={{ amount: remaining, currency }} />
          <span className="text-muted-foreground"> / </span>
          <MoneyDisplay money={{ amount, currency }} colorBySign={false} />
        </span>
      </div>
      <Progress
        value={layout.usedPct}
        className={cn(layout.isOver && '[&_[data-slot=progress-indicator]]:bg-status-danger')}
      />
    </div>
  )
}
