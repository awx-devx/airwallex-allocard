'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import type { FieldValues, UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import { BanIcon, EyeIcon, RefreshCwIcon, SnowflakeIcon, SunIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { AccessListSheet } from '@/app/(app)/cards/[id]/AccessListSheet'
import {
  useCard,
  useCardholder,
  useCardLimits,
  useCloseCard,
  useFreezeCard,
  useReconcileCard,
  useUnfreezeCard,
  useUpdateCard,
} from '@/client/hooks/useCards'
import { useOrgMembers } from '@/client/hooks/useOrganizations'
import { useProject } from '@/client/hooks/useProjects'
import { useCardTransactions } from '@/client/hooks/useTransactions'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  CLOSE_CONFIRM_PHRASE,
  accessListNames,
  canCloseCard,
  canEditCardMeta,
  canFreezeCard,
  canRevealCard,
  canUnfreezeCard,
  cardHolderUserId,
  cardLimitsToMeters,
  cardRevealHref,
  cardholderScreeningMessage,
  closedCardMessage,
  controlsDiverge,
  controlsToDiffView,
  failedCreateMessage,
  flattenTransactionPages,
  frozenCardMessage,
  holderLabel,
  isClosed,
  isFailed,
  isFrozen,
  isPendingCreate,
  isScreeningCardholder,
  isSingleUseUsed,
  isTerminalLost,
  lostCardMessage,
  manageCardDenialMessage,
  orgCardsHref,
  pendingCreateMessage,
  projectCardsHref,
  revealCardDenialMessage,
  ruleHref,
  singleUseUsedMessage,
} from '@/client/lib/cards'
import { cardExplainHref } from '@/client/lib/rules'
import {
  billedAsLabel,
  billingDiffers,
  declineReason,
  transactionHref,
  transactionListHref,
  transactionStatusLabel,
  transactionTypeLabel,
} from '@/client/lib/transactions'
import {
  archivedProjectMessage,
  auditListHref,
  isProjectArchived,
  viewInAuditLink,
} from '@/client/lib/reports'
import { applyServerErrorsFromApiError, useZodForm } from '@/client/lib/forms'
import { useCan } from '@/client/lib/permissions/useCan'
import { CardVisual } from '@/components/patterns/CardVisual'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { DiffView } from '@/components/patterns/DiffView'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LimitMeter } from '@/components/patterns/LimitMeter'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PageHeader } from '@/components/patterns/PageHeader'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatTile } from '@/components/patterns/StatTile'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card as GlassCard, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import type { Card } from '@/shared/types/card'
import type { Transaction } from '@/shared/types/transaction'

function CardAlerts({
  card,
  cardholderStatus,
  transactionCount,
}: {
  card: Card
  cardholderStatus: string | undefined
  transactionCount: number
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
  if (
    isSingleUseUsed({
      allowedTransactionCount: card.desiredControls.allowedTransactionCount,
      status: card.status,
      transactionCount,
    })
  ) {
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

function CardActions({ card, archived }: { card: Card; archived: boolean }) {
  const router = useRouter()
  const freeze = useFreezeCard()
  const unfreeze = useUnfreezeCard()
  const close = useCloseCard()
  const reconcile = useReconcileCard()
  const [dialog, setDialog] = useState<'freeze' | 'unfreeze' | 'close' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const projectId = card.projectId
  const { can, isLoading } = useCan(projectId ?? '')
  const manageAllowed =
    projectId !== null && projectId.length >= 1
      ? permissionGateAllowed(can(Permission.CARD_MANAGE, { cardId: card.id }), isLoading)
      : false
  const revealAllowed =
    projectId !== null && projectId.length >= 1
      ? permissionGateAllowed(can(Permission.CARD_VIEW_DETAILS, { cardId: card.id }), isLoading)
      : false
  const revealEligible = canRevealCard(card.status, card.airwallexCardId)
  const showFreeze = !archived && canFreezeCard(card.status)
  const showUnfreeze = !archived && canUnfreezeCard(card.status)
  const showClose = !archived && canCloseCard(card.status)
  const showReconcile = !archived && controlsDiverge(card.desiredControls, card.appliedControls)

  async function run(mutate: () => Promise<unknown>) {
    setActionError(null)
    try {
      await mutate()
    } catch (error) {
      setActionError(isApiError(error) ? error.message : 'Unable to update card')
    }
  }

  return (
    <>
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {archived ? null : (
          <PermissionGateView allowed={revealAllowed} denialMessage={revealCardDenialMessage()}>
            <Button
              type="button"
              disabled={!revealAllowed || !revealEligible}
              onClick={() => router.push(cardRevealHref(card.id))}
            >
              <EyeIcon className="size-4 shrink-0" aria-hidden />
              Reveal
            </Button>
          </PermissionGateView>
        )}
        {showFreeze ? (
          <PermissionGateView allowed={manageAllowed} denialMessage={manageCardDenialMessage()}>
            <Button type="button" disabled={!manageAllowed} onClick={() => setDialog('freeze')}>
              <SnowflakeIcon className="size-4 shrink-0" aria-hidden />
              Freeze
            </Button>
          </PermissionGateView>
        ) : null}
        {showUnfreeze ? (
          <PermissionGateView allowed={manageAllowed} denialMessage={manageCardDenialMessage()}>
            <Button type="button" disabled={!manageAllowed} onClick={() => setDialog('unfreeze')}>
              <SunIcon className="size-4 shrink-0" aria-hidden />
              Unfreeze
            </Button>
          </PermissionGateView>
        ) : null}
        {showClose ? (
          <PermissionGateView allowed={manageAllowed} denialMessage={manageCardDenialMessage()}>
            <Button
              type="button"
              variant="destructive"
              disabled={!manageAllowed}
              onClick={() => setDialog('close')}
            >
              <BanIcon className="size-4 shrink-0" aria-hidden />
              Close
            </Button>
          </PermissionGateView>
        ) : null}
        {showReconcile ? (
          <PermissionGateView allowed={manageAllowed} denialMessage={manageCardDenialMessage()}>
            <Button
              type="button"
              disabled={!manageAllowed || reconcile.isPending}
              onClick={() => void run(() => reconcile.mutateAsync({ id: card.id }))}
            >
              <RefreshCwIcon className="size-4 shrink-0" aria-hidden />
              Reconcile
            </Button>
          </PermissionGateView>
        ) : null}
      </div>
      <ConfirmDialog
        open={dialog === 'freeze'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Freeze this card?"
        description="You can unfreeze this card later."
        confirmLabel="Freeze"
        variant="default"
        loading={freeze.isPending}
        onConfirm={() => {
          setDialog(null)
          void run(() => freeze.mutateAsync({ id: card.id }))
        }}
      />
      <ConfirmDialog
        open={dialog === 'unfreeze'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Unfreeze this card?"
        description="The card will be able to transact again."
        confirmLabel="Unfreeze"
        variant="default"
        loading={unfreeze.isPending}
        onConfirm={() => {
          setDialog(null)
          void run(() => unfreeze.mutateAsync({ id: card.id }))
        }}
      />
      <ConfirmDialog
        open={dialog === 'close'}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        title="Close this card?"
        description="This cannot be undone. Pending transactions will still clear."
        confirmLabel="Close"
        variant="destructive"
        typeToConfirm={{ phrase: CLOSE_CONFIRM_PHRASE, prompt: 'Type CLOSE to confirm' }}
        loading={close.isPending}
        onConfirm={() => {
          setDialog(null)
          void run(() => close.mutateAsync({ id: card.id, input: { confirm: true } }))
        }}
      />
    </>
  )
}

const nickNameSchema = z.object({
  nickName: z.string().min(1).max(100),
})

function CardMetaEditor({ card, projectId }: { card: Card; projectId: string }) {
  const update = useUpdateCard()
  const { can, isLoading } = useCan(projectId)
  const allowed = permissionGateAllowed(can(Permission.CARD_MANAGE, { cardId: card.id }), isLoading)
  const form = useZodForm(nickNameSchema, { defaultValues: { nickName: card.nickName } })
  const [accessOpen, setAccessOpen] = useState(false)
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onSaveNick(values: { nickName: string }) {
    const nickName = values.nickName.trim()
    if (nickName.length < 1) {
      form.setError('nickName', { type: 'manual', message: 'Enter a nickname.' })
      return
    }
    if (nickName === card.nickName) return
    setAlertMessage(null)
    try {
      await update.mutateAsync({ id: card.id, input: { nickName } })
    } catch (error) {
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        applyServerErrorsFromApiError(form as unknown as UseFormReturn<FieldValues>, error)
        return
      }
      setAlertMessage(isApiError(error) ? error.message : 'Unable to update nickname')
    }
  }

  return (
    <>
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Form {...form}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={form.handleSubmit((values) => void onSaveNick(values))}
        >
          <FormField
            control={form.control}
            name="nickName"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1">
                <FormControl>
                  <Input {...field} maxLength={100} aria-label="Nickname" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <PermissionGateView allowed={allowed} denialMessage={manageCardDenialMessage()}>
            <Button type="submit" disabled={!allowed} loading={update.isPending}>
              Save nickname
            </Button>
          </PermissionGateView>
        </form>
      </Form>
      <PermissionGateView allowed={allowed} denialMessage={manageCardDenialMessage()}>
        <Button
          type="button"
          variant="outline"
          disabled={!allowed}
          onClick={() => setAccessOpen(true)}
        >
          Edit access
        </Button>
      </PermissionGateView>
      <AccessListSheet
        cardId={card.id}
        projectId={projectId}
        accessList={card.accessList}
        open={accessOpen}
        onOpenChange={setAccessOpen}
      />
    </>
  )
}

export function CardDetail() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const cardQuery = useCard(id)
  const card = cardQuery.data
  const project = useProject(card?.projectId ?? '')
  const cardholderQuery = useCardholder(card?.cardholderId ?? '')
  const membersQuery = useOrgMembers(card?.orgId ?? '')
  const limitsQuery = useCardLimits(id)
  const txQuery = useCardTransactions(id)

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
  const holderUserId = cardHolderUserId(card)
  const userName =
    holderUserId !== null
      ? membersQuery.data?.find(
          (row) => row.userId === holderUserId || row.user.id === holderUserId,
        )?.user.name
      : holder?.userId !== undefined && holder.userId !== null
        ? membersQuery.data?.find(
            (row) => row.userId === holder.userId || row.user.id === holder.userId,
          )?.user.name
        : undefined
  const accessNames = accessListNames(card.accessList, membersQuery.data ?? [])
  const meters = limitsQuery.data ? cardLimitsToMeters(limitsQuery.data) : []
  const diverge = controlsDiverge(card.desiredControls, card.appliedControls)
  const diff = diverge ? controlsToDiffView(card.appliedControls, card.desiredControls) : null
  const txRows = flattenTransactionPages(txQuery.data?.pages) as Transaction[]
  const archived = isProjectArchived(project.data?.status ?? '')
  const txColumns: DataTableColumn<Transaction>[] = [
    {
      id: 'transactedAt',
      header: 'Date',
      cell: (row) => formatDate(row.transactedAt),
    },
    {
      id: 'merchant',
      header: 'Merchant',
      cell: (row) => (
        <Link href={transactionHref(row.id)} className="min-w-0 break-words hover:underline">
          {row.merchant.name}
        </Link>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => (
        <div className="flex min-w-0 flex-col gap-1">
          <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} colorBySign />
          {billingDiffers(row.currency, row.billingCurrency) ? (
            <span className="min-w-0 text-xs text-muted-foreground">
              {billedAsLabel()}{' '}
              <MoneyDisplay
                money={{ amount: row.billingAmount, currency: row.billingCurrency }}
                colorBySign
              />
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex min-w-0 flex-col gap-1">
          <Badge variant="outline">{transactionStatusLabel(row.status)}</Badge>
          {row.status === TransactionStatus.DECLINED ? (
            <span className="min-w-0 break-words text-xs" title={declineReason(row.failureReason)}>
              {declineReason(row.failureReason)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => transactionTypeLabel(row.type),
    },
  ]

  return (
    <PageFlow>
      <PageHeader
        kicker={card.maskedNumber}
        title={card.nickName}
        actions={
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
            <Link
              href={auditListHref({ subjectType: 'card', subjectId: id })}
              className={buttonVariants({ variant: 'ghost' })}
            >
              {viewInAuditLink()}
            </Link>
          </div>
        }
      />
      {archived ? (
        <Alert>
          <AlertDescription>{archivedProjectMessage()}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <CardVisual
            nickName={card.nickName}
            maskedNumber={card.maskedNumber}
            status={card.status}
            purpose={card.purpose}
          />
          <CardActions card={card} archived={archived} />
          <CardAlerts
            card={card}
            cardholderStatus={cardholderQuery.data?.status}
            transactionCount={txRows.length}
          />
        </div>
        <GlassCard>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>Limits</CardTitle>
            <Link href={cardExplainHref(id)} className={buttonVariants({ variant: 'outline' })}>
              Why this limit?
            </Link>
          </CardHeader>
          <CardContent className="flex min-w-0 flex-col gap-3">
            {limitsQuery.isPending ? (
              <LoadingState rows={2} />
            ) : limitsQuery.error ? (
              <ErrorState
                message={
                  isApiError(limitsQuery.error)
                    ? limitsQuery.error.message
                    : 'Unable to load limits'
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
          </CardContent>
        </GlassCard>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-3">
        <StatTile label="Holder">
          {cardholderQuery.isPending ? (
            <LoadingState rows={1} />
          ) : (
            <div className="flex min-w-0 flex-col gap-1">
              <p className="min-w-0 break-all">
                {userName ??
                  holderUserId ??
                  (holder ? holderLabel(holder, undefined) : card.cardholderId)}
              </p>
              {holder ? (
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">{holder.type}</Badge>
                  <Badge variant="outline">{holder.status}</Badge>
                </div>
              ) : null}
            </div>
          )}
        </StatTile>
        <StatTile label="Access list">
          {membersQuery.isPending ? (
            <LoadingState rows={1} />
          ) : accessNames.length === 0 ? (
            <p className="text-muted-foreground">No one on the access list.</p>
          ) : (
            <ul className="flex min-w-0 flex-col gap-0.5">
              {accessNames.map((row) => (
                <li key={row.userId} className="min-w-0 break-all">
                  {row.name}
                </li>
              ))}
            </ul>
          )}
        </StatTile>
        {card.managedByRuleIds.length > 0 ? (
          <StatTile label="Created by rule">
            <p className="min-w-0 break-all">
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
          </StatTile>
        ) : null}
      </div>
      {!archived &&
      canEditCardMeta(card.status) &&
      card.projectId !== null &&
      card.projectId.length >= 1 ? (
        <CardMetaEditor card={card} projectId={card.projectId} />
      ) : null}
      {diff ? (
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-sm font-medium">Desired vs applied</h2>
          <DiffView before={diff.before} after={diff.after} />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <h2 className="text-sm font-medium">Transactions</h2>
          <Link
            href={transactionListHref({ cardId: id })}
            className={buttonVariants({ variant: 'ghost' })}
          >
            View in transactions
          </Link>
        </div>
        <DataTable
          columns={txColumns}
          rows={txRows}
          getRowId={(row) => row.id}
          pagination={{
            mode: 'cursor',
            nextCursor: txQuery.hasNextPage ? 'next' : null,
            onLoadMore: () => {
              void txQuery.fetchNextPage()
            },
            isFetchingMore: txQuery.isFetchingNextPage,
          }}
          loading={txQuery.isPending}
          error={
            txQuery.error
              ? {
                  message: isApiError(txQuery.error)
                    ? txQuery.error.message
                    : 'Unable to load transactions',
                  onRetry: () => void txQuery.refetch(),
                }
              : undefined
          }
          empty={{
            title: 'No transactions yet',
            description: 'Authorizations and clearings for this card appear here.',
          }}
        />
      </div>
    </PageFlow>
  )
}
