'use client'

import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget } from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useProjectMembers } from '@/client/hooks/useMembers'
import { useProject } from '@/client/hooks/useProjects'
import { useApprovals, useDecideRequest, useRequests } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  alreadyDecidedMessage,
  approvalHref,
  approvalProgress,
  approvalsListHref,
  budgetShortfallMessage,
  canDecideRequest,
  cardHref,
  decideRequestDenialMessage,
  formatApprovalProgress,
  formatEscalatedAt,
  holdQueueRow,
  isSelfApproval,
  mergeHeldQueueRows,
  noApprovalsEmpty,
  parseApprovalsSearchParams,
  projectCardsHref,
  recentApprovedSpend,
  remainingShortfall,
  selfApprovalMessage,
  unlockedCardIds,
  unlockedCardMessage,
  unlockedHeading,
  unlockedNoneLinkedMessage,
} from '@/client/lib/requests'
import { diffCardTransactionLimits, snapshotCardTransactionLimits } from '@/client/lib/budget'
import { useCan } from '@/client/lib/permissions/useCan'
import { isProjectArchived } from '@/client/lib/reports'
import { qk } from '@/client/queryKeys'
import { CardLimitMoves } from '@/app/(app)/projects/[id]/budget/CardLimitMoves'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/dates'
import { pageNextParam } from '@/lib/pagination'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type { CardList } from '@/shared/types/card'
import type { PurchaseRequest } from '@/shared/types/purchaseRequest'

const CARD_PAGE = { page: 1, pageSize: 100 } as const

function QueueItem({
  row,
  onHold,
}: {
  row: PurchaseRequest
  onHold: (row: PurchaseRequest) => void
}) {
  const me = useMe()
  const queryClient = useQueryClient()
  const decide = useDecideRequest()
  const members = useProjectMembers(row.projectId)
  const budgetQuery = useBudget(row.projectId)
  const recentQuery = useRequests(row.projectId, { page: 1, pageSize: 20 })
  const cards = useProjectCards(row.projectId, CARD_PAGE)
  const project = useProject(row.projectId)
  const { can, isLoading } = useCan(row.projectId)
  const allowed = permissionGateAllowed(can(Permission.REQUEST_APPROVE), isLoading)
  const viewerId = me.data?.user.id
  const self = isSelfApproval(row.requestedBy, viewerId)
  const archived = isProjectArchived(project.data?.status ?? '')
  const decided = !canDecideRequest(row.status, row.requestedBy, viewerId, row.approvals)
  const requesterName =
    (members.data ?? []).find((member) => member.userId === row.requestedBy)?.user.name ??
    row.requestedBy
  const remaining = budgetQuery.error ? undefined : budgetQuery.data?.projection.remaining
  const remainingCurrency = budgetQuery.data?.budget?.currency ?? row.currency
  const recentItems = recentQuery.error ? [] : (recentQuery.data?.items ?? [])
  const omitRecent =
    Boolean(recentQuery.error) &&
    isApiError(recentQuery.error) &&
    recentQuery.error.code === ErrorCode.PERMISSION_DENIED
  const spend = omitRecent ? [] : recentApprovedSpend(recentItems, row.requestedBy, row.id)
  const progress = approvalProgress(row)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [alertMessage, setAlertMessage] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState<{
    cardId: string | null
    newIds: string[]
    diffs: ReturnType<typeof diffCardTransactionLimits>
    cardTotal: number
    stillPending: boolean
  } | null>(null)

  async function onApprove() {
    setAlertMessage(null)
    onHold(row)
    const before = snapshotCardTransactionLimits(cards.data?.items ?? [])
    const beforeIds = (cards.data?.items ?? []).map((card) => card.id)
    try {
      const after = await decide.mutateAsync({
        id: row.id,
        input: { decision: 'APPROVE' },
      })
      onHold(after)
      if (after.status !== PurchaseRequestStatus.APPROVED) {
        setUnlocked({
          cardId: after.cardId,
          newIds: [],
          diffs: [],
          cardTotal: cards.data?.total ?? 0,
          stillPending: true,
        })
        return
      }
      if (after.cardId !== null && after.cardId.length >= 1) {
        setUnlocked({
          cardId: after.cardId,
          newIds: [],
          diffs: [],
          cardTotal: cards.data?.total ?? 0,
          stillPending: false,
        })
        return
      }
      await queryClient.invalidateQueries({ queryKey: qk.cardsForProject(row.projectId) })
      await queryClient.refetchQueries({ queryKey: qk.cardsForProject(row.projectId) })
      const afterList = queryClient.getQueryData<CardList>(
        qk.cardsForProject(row.projectId, CARD_PAGE),
      )
      const afterItems = afterList?.items ?? cards.data?.items ?? []
      setUnlocked({
        cardId: after.cardId,
        newIds: unlockedCardIds(
          beforeIds,
          afterItems.map((card) => card.id),
        ),
        diffs: diffCardTransactionLimits(before, snapshotCardTransactionLimits(afterItems)),
        cardTotal: afterList?.total ?? cards.data?.total ?? 0,
        stillPending: false,
      })
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to approve request')
    }
  }

  async function onReject() {
    const trimmed = reason.trim()
    if (trimmed.length < 1) return
    setAlertMessage(null)
    try {
      await decide.mutateAsync({
        id: row.id,
        input: { decision: 'REJECT', reason: trimmed },
      })
      setRejectOpen(false)
      setReason('')
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to reject request')
    }
  }

  const showDecide = !self && !decided && !archived

  return (
    <Card className="min-w-0">
      <CardContent className="flex min-w-0 flex-col gap-3">
        {alertMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{alertMessage}</AlertDescription>
          </Alert>
        ) : null}
        {self ? (
          <Alert>
            <AlertDescription>{selfApprovalMessage()}</AlertDescription>
          </Alert>
        ) : null}
        {!self && decided && row.status === PurchaseRequestStatus.PENDING ? (
          <Alert>
            <AlertDescription>{alreadyDecidedMessage()}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-2">
          <span className="min-w-0 break-words">{row.vendor}</span>
          <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} />
          <StatusBadge kind="request" status={row.status} />
        </div>
        <p className="min-w-0 text-sm">Requester: {requesterName}</p>
        <p className="min-w-0 break-words text-sm">{row.justification}</p>
        {remaining !== undefined ? (
          <div className="min-w-0">
            <p className="text-sm">
              Remaining <MoneyDisplay money={{ amount: remaining, currency: remainingCurrency }} />
            </p>
            {remainingShortfall(remaining, row.amount) ? (
              <Alert>
                <AlertDescription>{budgetShortfallMessage()}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
        {omitRecent || spend.length === 0 ? null : (
          <ul className="flex min-w-0 flex-col gap-1">
            {spend.map((item) => (
              <li key={`${item.vendor}-${item.amount}`} className="flex min-w-0 flex-wrap gap-2">
                <span className="min-w-0 break-words text-sm">{item.vendor}</span>
                <MoneyDisplay money={{ amount: item.amount, currency: item.currency }} />
              </li>
            ))}
          </ul>
        )}
        {row.escalatedAt ? (
          <p className="text-sm">{formatEscalatedAt(row.escalatedAt, formatDate)}</p>
        ) : null}
        {progress.required > 0 ? (
          <p className="text-sm">{formatApprovalProgress(progress)}</p>
        ) : null}
        {unlocked?.stillPending ? (
          <p className="text-sm">{formatApprovalProgress(approvalProgress(row))}</p>
        ) : null}
        {unlocked && !unlocked.stillPending ? (
          <div className="flex min-w-0 flex-col gap-2">
            {unlocked.cardId !== null && unlocked.cardId.length >= 1 ? (
              <p className="text-sm">
                {unlockedCardMessage()}{' '}
                <Link href={cardHref(unlocked.cardId)} className="hover:underline">
                  Open card
                </Link>
              </p>
            ) : unlocked.newIds.length > 0 || unlocked.diffs.length > 0 ? (
              <>
                <h2 className="text-sm font-medium">{unlockedHeading()}</h2>
                {unlocked.newIds.map((id) => (
                  <Link key={id} href={cardHref(id)} className="hover:underline">
                    Open card
                  </Link>
                ))}
                <CardLimitMoves
                  diffs={unlocked.diffs}
                  cardTotal={unlocked.cardTotal}
                  projectId={row.projectId}
                />
              </>
            ) : (
              <p className="text-sm">
                {unlockedNoneLinkedMessage()}{' '}
                <Link href={projectCardsHref(row.projectId)} className="hover:underline">
                  Project cards
                </Link>
              </p>
            )}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {showDecide ? (
            <PermissionGateView allowed={allowed} denialMessage={decideRequestDenialMessage()}>
              <Button
                type="button"
                disabled={!allowed || decide.isPending}
                loading={decide.isPending}
                onClick={() => void onApprove()}
              >
                Approve
              </Button>
            </PermissionGateView>
          ) : null}
          {showDecide ? (
            <PermissionGateView allowed={allowed} denialMessage={decideRequestDenialMessage()}>
              <Button
                type="button"
                variant="outline"
                disabled={!allowed}
                onClick={() => setRejectOpen(true)}
              >
                Reject
              </Button>
            </PermissionGateView>
          ) : null}
          <Link href={approvalHref(row.id)} className={buttonVariants({ variant: 'outline' })}>
            Review
          </Link>
        </div>
        <ConfirmDialog
          open={rejectOpen}
          onOpenChange={(open) => {
            setRejectOpen(open)
            if (!open) setReason('')
          }}
          title="Reject this request?"
          description="A reason is required and is shown to the requester."
          confirmLabel="Reject"
          variant="destructive"
          loading={decide.isPending}
          confirmDisabled={reason.trim().length < 1}
          onConfirm={() => void onReject()}
        >
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor={`reject-reason-${row.id}`}>Reason</Label>
            <Textarea
              id={`reject-reason-${row.id}`}
              value={reason}
              maxLength={2000}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </ConfirmDialog>
      </CardContent>
    </Card>
  )
}

export function ApprovalsQueue() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseApprovalsSearchParams({
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const query = useApprovals(filter)
  const [held, setHeld] = useState<PurchaseRequest[]>([])

  function holdRow(row: PurchaseRequest) {
    setHeld((prev) => holdQueueRow(prev, row))
  }

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load approvals'}
      />
    )
  }

  const rows = mergeHeldQueueRows(query.data.items, held)
  if (rows.length === 0) {
    const empty = noApprovalsEmpty()
    return <EmptyState title={empty.title} description={empty.description} />
  }

  const page = query.data.page
  const pageSize = query.data.pageSize
  const next = pageNextParam(query.data)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-4">
        {rows.map((row) => (
          <QueueItem key={row.id} row={row} onHold={holdRow} />
        ))}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => router.push(approvalsListHref({ page: page - 1, pageSize }))}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={next === undefined}
          onClick={() => router.push(approvalsListHref({ page: page + 1, pageSize }))}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
