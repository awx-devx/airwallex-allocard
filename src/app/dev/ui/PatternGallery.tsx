'use client'

import { moneyJpy, moneyNegative, moneyUsd } from '@/app/dev/ui/fixtures'
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
    </>
  )
}
