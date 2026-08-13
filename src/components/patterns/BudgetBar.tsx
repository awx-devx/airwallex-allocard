import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { budgetBarFillWidths, budgetBarLayout } from '@/components/patterns/budgetBarLayout'
import type { BudgetBarProps } from '@/components/patterns/types'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { formatMoney } from '@/lib/money'

export function BudgetBar(props: BudgetBarProps) {
  const layout = budgetBarLayout(props)
  const fill = budgetBarFillWidths(layout)
  const { currency, approved, committed, actual, remaining } = props
  const aria = [
    `Approved ${formatMoney({ amount: approved, currency })}`,
    `committed ${formatMoney({ amount: committed, currency })}`,
    `actual ${formatMoney({ amount: actual, currency })}`,
    `remaining ${formatMoney({ amount: remaining, currency })}`,
  ].join(', ')

  return (
    <div className="space-y-2">
      <div
        role="img"
        aria-label={aria}
        className="flex h-3 w-full overflow-hidden rounded-sm bg-budget-remaining"
      >
        <div className="h-full bg-budget-actual" style={{ width: `${fill.actual}%` }} />
        <div className="h-full bg-budget-committed" style={{ width: `${fill.committed}%` }} />
        {layout.isOver ? (
          <div
            className="h-full bg-budget-over"
            style={{ width: `${Math.min(layout.overPct, 100)}%` }}
          />
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Approved</dt>
          <dd>
            <MoneyDisplay money={{ amount: approved, currency }} colorBySign={false} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            <Tooltip>
              <TooltipTrigger className="underline-offset-4 hover:underline">
                Committed
              </TooltipTrigger>
              <TooltipContent>Approved but not yet spent</TooltipContent>
            </Tooltip>
          </dt>
          <dd>
            <MoneyDisplay money={{ amount: committed, currency }} colorBySign={false} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual</dt>
          <dd>
            <MoneyDisplay money={{ amount: actual, currency }} colorBySign={false} />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Remaining</dt>
          <dd>
            <MoneyDisplay money={{ amount: remaining, currency }} />
          </dd>
        </div>
      </dl>
    </div>
  )
}
