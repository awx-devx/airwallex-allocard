'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget, useBudgetCategories } from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useProjectMembers } from '@/client/hooks/useMembers'
import { useDecideRequest, useRequest, useRequests } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  alreadyDecidedMessage,
  approvalProgress,
  approvalsHref,
  budgetShortfallMessage,
  canDecideRequest,
  cardHref,
  decideRequestDenialMessage,
  expiredRequestMessage,
  formatApprovalProgress,
  formatApprovalRequired,
  formatEscalatedAt,
  isSelfApproval,
  parseOptionalIdParam,
  policyPreviewHeading,
  projectCardsHref,
  recentApprovedSpend,
  rejectedFallbackMessage,
  rejectionReason,
  remainingShortfall,
  requestHref,
  requestNotFoundMessage,
  selfApprovalMessage,
  unlockedCardIds,
  unlockedCardMessage,
  unlockedHeading,
  unlockedNoneLinkedMessage,
} from '@/client/lib/requests'
import { diffCardTransactionLimits, snapshotCardTransactionLimits } from '@/client/lib/budget'
import { useCan } from '@/client/lib/permissions/useCan'
import { qk } from '@/client/queryKeys'
import { CardLimitMoves } from '@/app/(app)/projects/[id]/budget/CardLimitMoves'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Timeline } from '@/components/patterns/Timeline'
import type { TimelineItem } from '@/components/patterns/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ActorType } from '@/shared/enums/audit'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { formatDate } from '@/lib/dates'
import type { CardList } from '@/shared/types/card'
import type { PolicyDecision, PurchaseRequest } from '@/shared/types/purchaseRequest'

const CARD_PAGE = { page: 1, pageSize: 100 } as const

function PolicyPane({ decision }: { decision: PolicyDecision }) {
  if (decision.outcome === PolicyOutcome.APPROVAL_REQUIRED) {
    return <p className="text-sm">{formatApprovalRequired(decision.requiredApprovals)}</p>
  }
  if (decision.outcome === PolicyOutcome.NOT_PERMITTED) {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-medium">{policyPreviewHeading(decision.outcome)}</p>
        {decision.reasons.map((reason) => (
          <p key={reason} className="text-sm">
            {reason}
          </p>
        ))}
      </div>
    )
  }
  return <p className="text-sm">{policyPreviewHeading(decision.outcome)}</p>
}

function UnlockedRead({ request }: { request: PurchaseRequest }) {
  if (request.cardId !== null && request.cardId.length >= 1) {
    return (
      <p className="text-sm">
        {unlockedCardMessage()}{' '}
        <Link href={cardHref(request.cardId)} className="hover:underline">
          Open card
        </Link>
      </p>
    )
  }
  return (
    <p className="text-sm">
      {unlockedNoneLinkedMessage()}{' '}
      <Link href={projectCardsHref(request.projectId)} className="hover:underline">
        Project cards
      </Link>
    </p>
  )
}

export function ApprovalDetail() {
  const raw = useParams().id
  const id = parseOptionalIdParam(
    typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined,
  )
  const me = useMe()
  const query = useRequest(id ?? '')
  const members = useProjectMembers(query.data?.projectId ?? '')
  const categories = useBudgetCategories(query.data?.projectId ?? '')
  const budgetQuery = useBudget(query.data?.projectId ?? '')
  const recentQuery = useRequests(query.data?.projectId ?? '', { page: 1, pageSize: 20 })
  const cards = useProjectCards(query.data?.projectId ?? '', CARD_PAGE)
  const decide = useDecideRequest()
  const queryClient = useQueryClient()
  const { can, isLoading } = useCan(query.data?.projectId ?? '')
  const allowed = permissionGateAllowed(
    Boolean(query.data?.projectId) && can(Permission.REQUEST_APPROVE),
    isLoading,
  )
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

  if (!id) {
    return <ErrorState message={requestNotFoundMessage()} />
  }

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message={requestNotFoundMessage()} />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load request'}
      />
    )
  }

  const data = query.data
  const viewerId = me.data?.user.id
  const self = isSelfApproval(data.requestedBy, viewerId)
  const canDecide = canDecideRequest(data.status, data.requestedBy, viewerId, data.approvals)
  const nameOf = new Map((members.data ?? []).map((member) => [member.userId, member.user.name]))
  const requesterName = nameOf.get(data.requestedBy) ?? data.requestedBy
  const categoryName =
    data.categoryId === null
      ? null
      : ((categories.data ?? []).find((category) => category.id === data.categoryId)?.name ??
        data.categoryId)
  const remaining = budgetQuery.error ? undefined : budgetQuery.data?.projection.remaining
  const remainingCurrency = budgetQuery.data?.budget?.currency ?? data.currency
  const omitRecent =
    Boolean(recentQuery.error) &&
    isApiError(recentQuery.error) &&
    recentQuery.error.code === ErrorCode.PERMISSION_DENIED
  const spend = omitRecent
    ? []
    : recentApprovedSpend(recentQuery.data?.items ?? [], data.requestedBy, data.id)
  const trail: TimelineItem[] = data.approvals.map((entry) => ({
    id: `${entry.approverId}-${entry.at}`,
    at: entry.at,
    actorType: ActorType.USER,
    actorId: entry.approverId,
    actorName: nameOf.get(entry.approverId) ?? entry.approverId,
    summary: entry.reason ? `${entry.decision}: ${entry.reason}` : entry.decision,
  }))
  const progress = approvalProgress(data)
  const rejected = rejectionReason(data.approvals)

  async function onApprove() {
    setAlertMessage(null)
    const before = snapshotCardTransactionLimits(cards.data?.items ?? [])
    const beforeIds = (cards.data?.items ?? []).map((card) => card.id)
    try {
      const after = await decide.mutateAsync({
        id: data.id,
        input: { decision: 'APPROVE' },
      })
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
      await queryClient.invalidateQueries({ queryKey: qk.cardsForProject(data.projectId) })
      await queryClient.refetchQueries({ queryKey: qk.cardsForProject(data.projectId) })
      const afterList = queryClient.getQueryData<CardList>(
        qk.cardsForProject(data.projectId, CARD_PAGE),
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
        id: data.id,
        input: { decision: 'REJECT', reason: trimmed },
      })
      setRejectOpen(false)
      setReason('')
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to reject request')
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Link href={approvalsHref()} className={buttonVariants({ variant: 'ghost' })}>
          Back
        </Link>
        <Link href={requestHref(data.id)} className={buttonVariants({ variant: 'ghost' })}>
          View as request
        </Link>
      </div>
      {alertMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{alertMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-wrap gap-2">
        <h1 className="min-w-0 text-lg font-medium">{data.vendor}</h1>
        <StatusBadge kind="request" status={data.status} />
        <MoneyDisplay money={{ amount: data.amount, currency: data.currency }} />
      </div>
      <p className="min-w-0 text-sm">Requester: {requesterName}</p>
      {categoryName ? <p className="min-w-0 text-sm">Category: {categoryName}</p> : null}
      <p className="min-w-0 break-words text-sm">{data.description}</p>
      <p className="min-w-0 break-words text-sm">{data.justification}</p>
      {data.status === PurchaseRequestStatus.REJECTED ? (
        <Alert variant="destructive">
          <AlertTitle>Rejected</AlertTitle>
          <AlertDescription>{rejected ?? rejectedFallbackMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {data.status === PurchaseRequestStatus.EXPIRED ? (
        <Alert>
          <AlertDescription>{expiredRequestMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {data.escalatedAt ? (
        <p className="text-sm">{formatEscalatedAt(data.escalatedAt, formatDate)}</p>
      ) : null}
      {remaining !== undefined ? (
        <div className="min-w-0">
          <p className="text-sm">
            Remaining <MoneyDisplay money={{ amount: remaining, currency: remainingCurrency }} />
          </p>
          {remainingShortfall(remaining, data.amount) ? (
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
      {data.policyDecision ? (
        <div className="flex min-w-0 flex-col gap-1">
          <PolicyPane decision={data.policyDecision} />
          {data.policyDecision.reasons.map((policyReason) =>
            data.policyDecision?.outcome === PolicyOutcome.NOT_PERMITTED ? null : (
              <p key={policyReason} className="text-sm">
                {policyReason}
              </p>
            ),
          )}
          {progress.required > 0 ? (
            <p className="text-sm">{formatApprovalProgress(progress)}</p>
          ) : null}
        </div>
      ) : null}
      <div className="min-w-0">
        <h2 className="mb-2 text-sm font-medium">Approval trail</h2>
        <Timeline items={trail} />
      </div>
      {self ? (
        <Alert>
          <AlertDescription>{selfApprovalMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {!self && !canDecide && data.status === PurchaseRequestStatus.PENDING ? (
        <Alert>
          <AlertDescription>{alreadyDecidedMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {data.status === PurchaseRequestStatus.APPROVED && unlocked === null ? (
        <UnlockedRead request={data} />
      ) : null}
      {unlocked?.stillPending ? (
        <p className="text-sm">{formatApprovalProgress(progress)}</p>
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
              {unlocked.newIds.map((cardId) => (
                <Link key={cardId} href={cardHref(cardId)} className="hover:underline">
                  Open card
                </Link>
              ))}
              <CardLimitMoves
                diffs={unlocked.diffs}
                cardTotal={unlocked.cardTotal}
                projectId={data.projectId}
              />
            </>
          ) : (
            <p className="text-sm">
              {unlockedNoneLinkedMessage()}{' '}
              <Link href={projectCardsHref(data.projectId)} className="hover:underline">
                Project cards
              </Link>
            </p>
          )}
        </div>
      ) : null}
      {canDecide ? (
        <div className="flex flex-wrap gap-2">
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
        </div>
      ) : null}
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
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            maxLength={2000}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </div>
  )
}
