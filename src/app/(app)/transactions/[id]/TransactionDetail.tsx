'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCard } from '@/client/hooks/useCards'
import { useTransaction } from '@/client/hooks/useTransactions'
import {
  authClearingDiffer,
  authClearingDifferMessage,
  billedAsLabel,
  billingDiffers,
  cardExplainHref,
  cardHref,
  closedCardMessage,
  declineReason,
  isPendingAuthorization,
  isReversalType,
  lifecycleHeading,
  lifecycleSorted,
  needsReceipt,
  parseOptionalIdParam,
  partialClearingMessage,
  pendingAuthMessage,
  receiptLabel,
  receiptsHref,
  reversalMessage,
  transactionHref,
  transactionListHref,
  transactionNotFoundMessage,
  transactionStatusLabel,
  transactionTypeLabel,
  whyThisLimitLink,
} from '@/client/lib/transactions'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import type { Transaction } from '@/shared/types/transaction'

function AmountBlock({
  amount,
  currency,
  billingAmount,
  billingCurrency,
}: {
  amount: number
  currency: string
  billingAmount: number
  billingCurrency: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <MoneyDisplay money={{ amount, currency }} colorBySign />
      {billingDiffers(currency, billingCurrency) ? (
        <span className="min-w-0 text-sm text-muted-foreground">
          {billedAsLabel()}{' '}
          <MoneyDisplay money={{ amount: billingAmount, currency: billingCurrency }} colorBySign />
        </span>
      ) : null}
    </div>
  )
}

function LifecycleEvent({ event, currentId }: { event: Transaction; currentId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      {event.id === currentId ? (
        <span className="min-w-0 break-words text-sm font-medium">
          {transactionTypeLabel(event.type)}
        </span>
      ) : (
        <Link
          href={transactionHref(event.id)}
          className="min-w-0 break-words text-sm hover:underline"
        >
          {transactionTypeLabel(event.type)}
        </Link>
      )}
      <Badge variant="outline" className="w-fit">
        {transactionStatusLabel(event.status)}
      </Badge>
      <AmountBlock
        amount={event.amount}
        currency={event.currency}
        billingAmount={event.billingAmount}
        billingCurrency={event.billingCurrency}
      />
      <p className="text-xs text-muted-foreground">{formatDateTime(event.transactedAt)}</p>
    </div>
  )
}

export function TransactionDetail() {
  const raw = useParams().id
  const id = parseOptionalIdParam(
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined,
  )
  const query = useTransaction(id ?? '')
  const cardQuery = useCard(query.data?.cardId ?? '')

  if (!id) {
    return <ErrorState message={transactionNotFoundMessage()} />
  }

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message={transactionNotFoundMessage()} />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load transaction'}
      />
    )
  }

  const data = query.data
  const chain = data.lifecycleEvents.length > 0 ? lifecycleSorted(data.lifecycleEvents) : [data]
  const showClosed = cardQuery.data?.status === CardStatus.CLOSED

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap gap-2">
        <Link
          href={transactionListHref({ projectId: data.projectId })}
          className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit')}
        >
          Back
        </Link>
        <Link
          href={cardHref(data.cardId)}
          className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit')}
        >
          Card
        </Link>
      </div>
      <div className="flex min-w-0 flex-wrap gap-2">
        <h1 className="min-w-0 break-words text-lg font-medium">{data.merchant.name}</h1>
        <Badge variant="outline">{transactionStatusLabel(data.status)}</Badge>
        <Badge variant="outline">{transactionTypeLabel(data.type)}</Badge>
        <AmountBlock
          amount={data.amount}
          currency={data.currency}
          billingAmount={data.billingAmount}
          billingCurrency={data.billingCurrency}
        />
      </div>
      <p className="min-w-0 break-words text-sm text-muted-foreground">
        MCC {data.merchant.mcc} · {data.merchant.country}
      </p>
      {isPendingAuthorization(data.status, chain) ? (
        <Alert>
          <AlertDescription>{pendingAuthMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {authClearingDiffer(chain) ? (
        <Alert>
          <AlertDescription>{authClearingDifferMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {data.type === TransactionType.PARTIAL_CLEARING ? (
        <Alert>
          <AlertDescription>{partialClearingMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {isReversalType(data.type) || data.status === TransactionStatus.REVERSED ? (
        <Alert>
          <AlertDescription>{reversalMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {showClosed ? (
        <Alert>
          <AlertDescription>{closedCardMessage()}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium">{lifecycleHeading()}</h2>
        {chain.map((event) => (
          <LifecycleEvent key={event.id} event={event} currentId={data.id} />
        ))}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="min-w-0 text-sm">{receiptLabel(data)}</p>
        {needsReceipt(data) ? (
          <Link href={receiptsHref()} className={buttonVariants({ variant: 'ghost' })}>
            Receipts
          </Link>
        ) : null}
      </div>
      {data.status === TransactionStatus.DECLINED ? (
        <div className="flex min-w-0 flex-col gap-2">
          <p className="min-w-0 break-words text-sm">{declineReason(data.failureReason)}</p>
          <Link
            href={cardExplainHref(data.cardId)}
            className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit')}
          >
            {whyThisLimitLink()}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
