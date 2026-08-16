'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCardExplain } from '@/client/hooks/useRules'
import { cardHref } from '@/client/lib/cards'
import { parseOptionalIdParam, ruleBuilderHref, ruleHref } from '@/client/lib/rules'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { DiffView } from '@/components/patterns/DiffView'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'

function allowlistText(value: string[] | null): string {
  if (value === null) return 'Unconstrained'
  return value.join(', ')
}

export function CardExplain() {
  const raw = useParams().id
  const id =
    parseOptionalIdParam(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined) ?? ''
  const query = useCardExplain(id)

  if (!id) {
    return <ErrorState message="This card is not available." />
  }

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This card is not available." />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to explain card'}
      />
    )
  }

  const explain = query.data
  const limits = explain.finalControls.transactionLimits

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Link href={cardHref(id)} className={buttonVariants({ variant: 'outline' })}>
        Back
      </Link>
      <h1 className="text-lg font-medium">Why this limit?</h1>
      <Badge variant="outline">{explain.finalStatus}</Badge>
      <div className="flex min-w-0 flex-col gap-2">
        {limits.limits.map((entry) => (
          <p key={entry.interval} className="text-sm">
            {entry.interval}{' '}
            <MoneyDisplay money={{ amount: entry.amount, currency: limits.currency }} />
          </p>
        ))}
        <p className="min-w-0 break-all text-sm">
          Currencies: {allowlistText(explain.finalControls.allowedCurrencies)}
        </p>
        <p className="min-w-0 break-all text-sm">
          Merchant categories: {allowlistText(explain.finalControls.allowedMerchantCategories)}
        </p>
        <p className="min-w-0 break-all text-sm">
          Merchant countries: {allowlistText(explain.finalControls.allowedMerchantCountries)}
        </p>
        <p className="min-w-0 break-all text-sm">
          Merchant brands: {allowlistText(explain.finalControls.allowedMerchantBrands)}
        </p>
      </div>
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium">Governing rules</h2>
        {explain.governingRules.map((rule) => (
          <div key={rule.ruleId} className="flex min-w-0 flex-col gap-2">
            <Link href={ruleBuilderHref(rule.ruleId)} className="hover:underline">
              {rule.name}
            </Link>
            {explain.projectId !== null && explain.projectId.length >= 1 ? (
              <Link
                href={ruleHref(explain.projectId, rule.ruleId)}
                className="text-sm hover:underline"
              >
                Project controls
              </Link>
            ) : null}
            <p className="text-sm">matched: {rule.matched ? 'Yes' : 'No'}</p>
            <p className="text-sm">priority: {rule.priority}</p>
            <DiffView before={null} after={rule.contribution ?? null} />
          </div>
        ))}
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        {explain.attributeValues.map((item) => (
          <AttributeValue
            key={item.id}
            value={item.value}
            observedAt={item.observedAt}
            ttlSec={item.ttlSec}
            label={item.key}
          />
        ))}
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium">How rules merged</h2>
        {explain.merge.map((entry) => (
          <div key={entry.field} className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium">{entry.field}</p>
            <p className="text-sm">{entry.strategy}</p>
            {entry.contributions.map((contribution) => (
              <p
                key={`${contribution.ruleId}-${contribution.priority}`}
                className="min-w-0 break-all text-sm"
              >
                {contribution.ruleName} ({contribution.priority}): {String(contribution.value)}
              </p>
            ))}
            <p className="min-w-0 break-all text-sm">result: {String(entry.result)}</p>
          </div>
        ))}
      </section>
      {explain.conflicts.map((conflict) => (
        <Alert key={conflict.message} variant="destructive">
          <AlertDescription>{conflict.message}</AlertDescription>
        </Alert>
      ))}
      {explain.lastEvaluatedAt ? (
        <p className="text-sm">Last evaluated {formatDate(explain.lastEvaluatedAt)}</p>
      ) : null}
      {explain.lastRuleRunId ? (
        <p className="text-sm">lastRuleRunId {explain.lastRuleRunId}</p>
      ) : null}
    </div>
  )
}
