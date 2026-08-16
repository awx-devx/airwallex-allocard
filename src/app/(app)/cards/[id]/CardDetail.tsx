'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useCard, useCardholder, useCardLimits } from '@/client/hooks/useCards'
import { useOrgMembers } from '@/client/hooks/useOrganizations'
import {
  accessListNames,
  cardLimitsToMeters,
  cardholderScreeningMessage,
  closedCardMessage,
  controlsDiverge,
  controlsToDiffView,
  failedCreateMessage,
  frozenCardMessage,
  holderLabel,
  isClosed,
  isFailed,
  isFrozen,
  isPendingCreate,
  isScreeningCardholder,
  isSingleUse,
  isTerminalLost,
  lostCardMessage,
  orgCardsHref,
  pendingCreateMessage,
  projectCardsHref,
  ruleHref,
  singleUseUsedMessage,
} from '@/client/lib/cards'
import { CardVisual } from '@/components/patterns/CardVisual'
import { DiffView } from '@/components/patterns/DiffView'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LimitMeter } from '@/components/patterns/LimitMeter'
import { LoadingState } from '@/components/patterns/LoadingState'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { Card } from '@/shared/types/card'

function CardAlerts({
  card,
  cardholderStatus,
}: {
  card: Card
  cardholderStatus: string | undefined
}) {
  const alerts: { key: string; message: string; destructive?: boolean }[] = []

  if (isPendingCreate(card.status)) {
    const screening = cardholderStatus !== undefined && isScreeningCardholder(cardholderStatus)
    alerts.push({
      key: 'pending',
      message: screening ? cardholderScreeningMessage() : pendingCreateMessage(),
    })
  }
  if (isFailed(card.status)) {
    alerts.push({ key: 'failed', message: failedCreateMessage(), destructive: true })
  }
  if (isFrozen(card.status)) {
    alerts.push({ key: 'frozen', message: frozenCardMessage() })
  }
  if (isClosed(card.status)) {
    alerts.push({ key: 'closed', message: closedCardMessage() })
  }
  if (isTerminalLost(card.status)) {
    alerts.push({
      key: 'lost',
      message: lostCardMessage(card.status as 'BLOCKED' | 'LOST' | 'STOLEN'),
    })
  }
  if (isSingleUse(card.desiredControls.allowedTransactionCount) && isClosed(card.status)) {
    alerts.push({ key: 'single-use', message: singleUseUsedMessage() })
  }

  return (
    <>
      {alerts.map((alert) => (
        <Alert key={alert.key} variant={alert.destructive ? 'destructive' : 'default'}>
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      ))}
    </>
  )
}

export function CardDetail() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const cardQuery = useCard(id)
  const card = cardQuery.data
  const cardholderQuery = useCardholder(card?.cardholderId ?? '')
  const membersQuery = useOrgMembers(card?.orgId ?? '')
  const limitsQuery = useCardLimits(id)

  if (!id) {
    return <ErrorState message="This card is not available." />
  }

  if (cardQuery.isPending) {
    return <LoadingState />
  }

  if (cardQuery.error) {
    if (isApiError(cardQuery.error) && cardQuery.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This card is not available." />
    }
    return (
      <ErrorState
        message={isApiError(cardQuery.error) ? cardQuery.error.message : 'Unable to load card'}
      />
    )
  }

  if (card === undefined) {
    return <ErrorState message="This card is not available." />
  }

  const holder = cardholderQuery.data
  const userName =
    holder?.userId !== undefined && holder.userId !== null
      ? membersQuery.data?.find(
          (row) => row.userId === holder.userId || row.user.id === holder.userId,
        )?.user.name
      : undefined
  const accessNames = accessListNames(card.accessList, membersQuery.data ?? [])
  const meters = limitsQuery.data ? cardLimitsToMeters(limitsQuery.data) : []
  const diverge = controlsDiverge(card.desiredControls, card.appliedControls)
  const diff = diverge ? controlsToDiffView(card.appliedControls, card.desiredControls) : null

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Link href={orgCardsHref()} className={buttonVariants({ variant: 'ghost' })}>
          All cards
        </Link>
        {card.projectId ? (
          <Link
            href={projectCardsHref(card.projectId)}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Project cards
          </Link>
        ) : null}
      </div>
      <CardVisual
        nickName={card.nickName}
        maskedNumber={card.maskedNumber}
        status={card.status}
        purpose={card.purpose}
      />
      {/* TODO(A5.5) freeze / unfreeze / close / reconcile */}
      {/* TODO(A5.6) reveal */}
      <CardAlerts card={card} cardholderStatus={cardholderQuery.data?.status} />
      {card.managedByRuleIds.length > 0 ? (
        <p className="text-sm">
          Created by rule{' '}
          {card.managedByRuleIds.map((ruleId, index) => (
            <span key={ruleId}>
              {index > 0 ? ', ' : null}
              {card.projectId !== null && card.projectId.length >= 1 ? (
                <Link href={ruleHref(card.projectId, ruleId)} className="hover:underline">
                  {ruleId}
                </Link>
              ) : (
                ruleId
              )}
            </span>
          ))}
        </p>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-medium">Holder</h2>
        <p className="text-sm">{holder ? holderLabel(holder, userName) : card.cardholderId}</p>
        {holder ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{holder.type}</Badge>
            <Badge variant="outline">{holder.status}</Badge>
          </div>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="text-sm font-medium">Access list</h2>
        {accessNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one on the access list.</p>
        ) : (
          <ul className="flex min-w-0 flex-col gap-1">
            {accessNames.map((row) => (
              <li key={row.userId} className="min-w-0 break-all text-sm">
                {row.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <h2 className="text-sm font-medium">Limits</h2>
        {limitsQuery.isPending ? (
          <LoadingState />
        ) : limitsQuery.error ? (
          <ErrorState
            message={
              isApiError(limitsQuery.error) ? limitsQuery.error.message : 'Unable to load limits'
            }
            onRetry={() => void limitsQuery.refetch()}
          />
        ) : (
          meters.map((row) => (
            <LimitMeter
              key={row.interval}
              interval={row.interval as TransactionLimitInterval}
              amount={row.amount}
              remaining={row.remaining}
              currency={row.currency}
            />
          ))
        )}
      </div>
      {diff ? (
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-medium">Desired vs applied</h2>
          <DiffView before={diff.before} after={diff.after} />
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">Transactions land in A5.8.</p>
    </div>
  )
}
