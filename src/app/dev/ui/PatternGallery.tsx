'use client'

import {
  attributeFresh,
  attributeStale,
  attributeTtlNull,
  budgetFull,
  budgetHealthy,
  budgetOver,
  budgetZero,
  budgetZeroWithSpend,
  limitEmpty,
  limitFull,
  limitJpyMonthly,
  limitOver,
  moneyJpy,
  moneyNegative,
  moneyUsd,
} from '@/app/dev/ui/fixtures'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { LimitMeter } from '@/components/patterns/LimitMeter'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'

export function PatternGallery() {
  return (
    <>
      <section id="money-display" className="space-y-2">
        <h3 className="font-medium">MoneyDisplay</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <MoneyDisplay money={moneyUsd} />
          <MoneyDisplay money={moneyUsd} compact />
          <MoneyDisplay money={moneyJpy} />
          <MoneyDisplay money={moneyNegative} />
          <MoneyDisplay money={{ amount: 0, currency: 'USD' }} />
        </div>
      </section>

      <section id="status-badge" className="space-y-3">
        <h3 className="font-medium">StatusBadge</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(ProjectStatus).map((status) => (
            <StatusBadge key={`p-${status}`} kind="project" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(CardStatus).map((status) => (
            <StatusBadge key={`c-${status}`} kind="card" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(PurchaseRequestStatus).map((status) => (
            <StatusBadge key={`r-${status}`} kind="request" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(RuleRunStatus).map((status) => (
            <StatusBadge key={`rr-${status}`} kind="ruleRun" status={status} />
          ))}
        </div>
      </section>

      <section id="budget-bar" className="space-y-4">
        <h3 className="font-medium">BudgetBar</h3>
        <BudgetBar {...budgetHealthy} />
        <BudgetBar {...budgetOver} />
        <BudgetBar {...budgetZero} />
        <BudgetBar {...budgetZeroWithSpend} />
        <BudgetBar {...budgetFull} />
      </section>

      <section id="limit-meter" className="space-y-4">
        <h3 className="font-medium">LimitMeter</h3>
        <LimitMeter {...limitEmpty} />
        <LimitMeter {...limitFull} />
        <LimitMeter {...limitOver} />
        <LimitMeter {...limitJpyMonthly} />
      </section>

      <section id="attribute-value" className="space-y-4">
        <h3 className="font-medium">AttributeValue</h3>
        <AttributeValue {...attributeFresh} />
        <AttributeValue {...attributeStale} />
        <AttributeValue {...attributeTtlNull} />
      </section>
    </>
  )
}
