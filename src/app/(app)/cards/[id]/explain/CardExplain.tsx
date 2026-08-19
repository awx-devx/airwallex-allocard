'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCardExplain } from '@/client/hooks/useRules'
import { cardHref } from '@/client/lib/cards'
import {
  contributionToDiffView,
  parseOptionalIdParam,
  ruleBuilderHref,
  ruleHref,
} from '@/client/lib/rules'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { DiffView } from '@/components/patterns/DiffView'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PageHeader } from '@/components/patterns/PageHeader'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'
import { cn } from '@/lib/utils'
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
    <PageFlow>
      <PageHeader
        title="Why this limit?"
        status={<Badge variant="outline">{explain.finalStatus}</Badge>}
        actions={
          <Link href={cardHref(id)} className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>
            Back
          </Link>
        }
      />
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Limits</CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-2">
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attributes</CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            {explain.attributeValues.map((item) => (
              <AttributeValue
                key={item.id}
                value={item.value}
                observedAt={item.observedAt}
                ttlSec={item.ttlSec}
                label={item.key}
              />
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Governing rules</CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
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
                <DiffView {...contributionToDiffView(rule.contribution)} />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>How rules merged</CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
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
          </CardContent>
        </Card>
      </div>
      {explain.conflicts.map((conflict) => (
        <Alert key={conflict.message} variant="destructive">
          <AlertDescription>{conflict.message}</AlertDescription>
        </Alert>
      ))}
      {explain.lastEvaluatedAt ? (
        <p className="text-sm">Last evaluated {formatDate(explain.lastEvaluatedAt)}</p>
      ) : null}
      {explain.lastRuleRunId ? (
        <p className="min-w-0 break-all text-sm">Last run {explain.lastRuleRunId}</p>
      ) : null}
    </PageFlow>
  )
}
