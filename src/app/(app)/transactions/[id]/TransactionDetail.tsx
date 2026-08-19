'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { PaperclipIcon } from 'lucide-react'
import { AttachReceiptSheet } from '@/app/(app)/receipts/ReceiptsQueue'
import { isApiError } from '@/client/api/errors'
import { useCard } from '@/client/hooks/useCards'
import { useProject } from '@/client/hooks/useProjects'
import { useDeleteReceipt, useTransaction } from '@/client/hooks/useTransactions'
import { permissionGateAllowed } from '@/client/lib/access'
import { manageCardDenialMessage } from '@/client/lib/cards'
import { useCan } from '@/client/lib/permissions/useCan'
import { archivedProjectMessage, isProjectArchived } from '@/client/lib/reports'
import {
  authClearingDiffer,
  authClearingDifferMessage,
  billedAsLabel,
  billingDiffers,
  cardExplainHref,
  cardHref,
  closedCardMessage,
  declineReason,
  isOptimisticReceiptId,
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
  viewTransactionsDenialMessage,
  whyThisLimitLink,
} from '@/client/lib/transactions'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PageHeader } from '@/components/patterns/PageHeader'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import type {
  Transaction,
  TransactionDetail as TransactionDetailData,
} from '@/shared/types/transaction'

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

function ReceiptActions({ data }: { data: TransactionDetailData }) {
  const [attachOpen, setAttachOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const remove = useDeleteReceipt()
  const project = useProject(data.projectId)
  const { can, isLoading } = useCan(data.projectId)
  const canView = permissionGateAllowed(can(Permission.TRANSACTION_VIEW), isLoading)
  const canManage = permissionGateAllowed(
    can(Permission.CARD_MANAGE, { cardId: data.cardId }),
    isLoading,
  )
  const archived = isProjectArchived(project.data?.status ?? '')
  const hasReceipt = data.receiptFileId !== null && data.receiptFileId.length >= 1
  const showAttach = !archived && (needsReceipt(data) || hasReceipt)
  const showRemove = !archived && hasReceipt && !isOptimisticReceiptId(data.receiptFileId)

  return (
    <>
      {archived ? (
        <Alert>
          <AlertDescription>{archivedProjectMessage()}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <p className="min-w-0 text-sm">{receiptLabel(data)}</p>
        {needsReceipt(data) ? (
          <Link href={receiptsHref()} className={buttonVariants({ variant: 'ghost' })}>
            Receipts
          </Link>
        ) : null}
        {showAttach ? (
          <PermissionGateView allowed={canView} denialMessage={viewTransactionsDenialMessage()}>
            <Button type="button" disabled={!canView} onClick={() => setAttachOpen(true)}>
              <PaperclipIcon className="size-4 shrink-0" aria-hidden />
              Attach receipt
            </Button>
          </PermissionGateView>
        ) : null}
        {showRemove ? (
          <PermissionGateView allowed={canManage} denialMessage={manageCardDenialMessage()}>
            <Button
              type="button"
              variant="destructive"
              disabled={!canManage}
              onClick={() => setRemoveOpen(true)}
            >
              Remove receipt
            </Button>
          </PermissionGateView>
        ) : null}
      </div>
      <AttachReceiptSheet transactionId={data.id} open={attachOpen} onOpenChange={setAttachOpen} />
      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title="Remove this receipt?"
        description="The file is deleted. You can attach another."
        confirmLabel="Remove receipt"
        variant="destructive"
        loading={remove.isPending}
        onConfirm={() => {
          setRemoveOpen(false)
          void remove.mutateAsync({ id: data.id })
        }}
      />
    </>
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
      <PageHeader
        title={data.merchant.name}
        status={
          <>
            <Badge variant="outline">{transactionStatusLabel(data.status)}</Badge>
            <Badge variant="outline">{transactionTypeLabel(data.type)}</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
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
        }
      />
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            <AmountBlock
              amount={data.amount}
              currency={data.currency}
              billingAmount={data.billingAmount}
              billingCurrency={data.billingCurrency}
            />
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
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{lifecycleHeading()}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            {chain.map((event) => (
              <LifecycleEvent key={event.id} event={event} currentId={data.id} />
            ))}
          </CardContent>
        </Card>
      </div>
      <ReceiptActions data={data} />
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
