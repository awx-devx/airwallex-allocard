'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget } from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useAccessReviews, useProjectMembers } from '@/client/hooks/useMembers'
import { useProject } from '@/client/hooks/useProjects'
import { useProjectActivity } from '@/client/hooks/useReports'
import { useRequests } from '@/client/hooks/useRequests'
import { accessReviewListHref, peopleHref } from '@/client/lib/access'
import { draftWizardHref, toTimelineItem } from '@/client/lib/projects'
import { closureHref, finalReportHref } from '@/client/lib/reports'
import { ErrorState, shouldShowErrorRetry } from '@/components/patterns/ErrorState'
import { PageFlow } from '@/components/patterns/PageBody'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Timeline, TimelinePanel } from '@/components/patterns/Timeline'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ErrorCode } from '@/shared/enums/errors'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'

function queryError(error: unknown): { message: string; code: ErrorCode | undefined } {
  if (isApiError(error)) {
    return { message: error.message, code: error.code }
  }
  return { message: 'Unable to load', code: undefined }
}

function QueryBody({
  isPending,
  error,
  onRetry,
  children,
}: {
  isPending: boolean
  error: unknown
  onRetry: () => void
  children: ReactNode
}) {
  if (isPending) {
    return <LoadingState rows={3} />
  }
  if (error) {
    const { message, code } = queryError(error)
    const retryable = shouldShowErrorRetry(code, true)
    return <ErrorState message={message} code={code} onRetry={retryable ? onRetry : undefined} />
  }
  return children
}

function OverviewTile({
  href,
  title,
  children,
  className,
}: {
  href: string
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>
          <Link href={href} className="hover:underline">
            {title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">{children}</div>
      </CardContent>
    </Card>
  )
}

export function ProjectOverview() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const project = useProject(id)
  const members = useProjectMembers(id)
  const budget = useBudget(id)
  const cards = useProjectCards(id, { page: 1, pageSize: 6 })
  const requests = useRequests(id, { page: 1, pageSize: 5 })
  const alerts = useAccessReviews({ status: 'OPEN', projectId: id })
  const activity = useProjectActivity(id)

  const notFound = isApiError(project.error) && project.error.code === ErrorCode.NOT_FOUND

  if (!id || notFound) {
    return <ErrorState message="This project is not available." />
  }

  if (project.isPending) {
    return <LoadingState />
  }

  if (project.error) {
    const { message, code } = queryError(project.error)
    return <ErrorState message={message} code={code} />
  }

  const status = project.data?.status
  const statusHref =
    status === ProjectStatus.CLOSING
      ? closureHref(id)
      : status === ProjectStatus.ARCHIVED || status === ProjectStatus.CLOSED
        ? finalReportHref(id)
        : status === ProjectStatus.DRAFT
          ? draftWizardHref(id)
          : `/projects/${id}/activity`
  const pendingRows = (requests.data?.items ?? []).filter(
    (row) => row.status === PurchaseRequestStatus.PENDING,
  )
  const activityItems = (activity.data?.pages[0]?.items ?? []).map(toTimelineItem)
  const budgetDetail = budget.data
  const overview = project.data?.overview
  const showBudgetFallback = budget.isPending && overview != null
  const cardTotal = cards.data?.total ?? (cards.isPending ? overview?.activeCardCount : undefined)

  return (
    <PageFlow>
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <OverviewTile href={statusHref} title="Status">
          {status ? <StatusBadge kind="project" status={status} /> : null}
        </OverviewTile>

        <OverviewTile href={peopleHref(id)} title={`Members (${members.data?.length ?? 0})`}>
          <QueryBody
            isPending={members.isPending}
            error={members.error}
            onRetry={() => void members.refetch()}
          >
            <p className="text-sm text-muted-foreground">
              {members.data?.length ?? 0} member{(members.data?.length ?? 0) === 1 ? '' : 's'}
            </p>
          </QueryBody>
        </OverviewTile>

        <OverviewTile href={`/projects/${id}/budget`} title="Remaining / spent">
          {showBudgetFallback &&
          (overview.budgetRemaining != null || overview.budgetSpent != null) ? (
            <div className="flex flex-col gap-2">
              {overview.budgetRemaining ? (
                <p className="flex min-w-0 flex-wrap items-center gap-2">
                  <span>Remaining</span>
                  <MoneyDisplay money={overview.budgetRemaining} />
                </p>
              ) : null}
              {overview.budgetSpent ? (
                <p className="flex min-w-0 flex-wrap items-center gap-2">
                  <span>Spent</span>
                  <MoneyDisplay money={overview.budgetSpent} />
                </p>
              ) : null}
            </div>
          ) : (
            <QueryBody
              isPending={budget.isPending}
              error={budget.error}
              onRetry={() => void budget.refetch()}
            >
              {budgetDetail?.budget == null ? (
                <p>No budget set</p>
              ) : (
                <>
                  <p className="flex min-w-0 flex-wrap items-center gap-2">
                    <span>Remaining</span>
                    <MoneyDisplay
                      money={{
                        amount: budgetDetail.projection.remaining,
                        currency: budgetDetail.budget.currency,
                      }}
                    />
                  </p>
                  <p className="flex min-w-0 flex-wrap items-center gap-2">
                    <span>Spent</span>
                    <MoneyDisplay
                      money={{
                        amount: budgetDetail.projection.actual,
                        currency: budgetDetail.budget.currency,
                      }}
                    />
                  </p>
                </>
              )}
            </QueryBody>
          )}
        </OverviewTile>

        <OverviewTile href={`/projects/${id}/cards`} title={`Active cards (${cardTotal ?? 0})`}>
          <QueryBody
            isPending={cards.isPending}
            error={cards.error}
            onRetry={() => void cards.refetch()}
          >
            {(cards.data?.items.length ?? 0) === 0 ? (
              <p>No cards yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {cards.data?.items.map((card) => (
                  <li key={card.id} className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all">{card.nickName}</span>
                    <span className="text-sm text-muted-foreground">{card.maskedNumber}</span>
                  </li>
                ))}
              </ul>
            )}
          </QueryBody>
        </OverviewTile>

        <OverviewTile href="/approvals" title={`Pending approvals (${pendingRows.length})`}>
          <QueryBody
            isPending={requests.isPending}
            error={requests.error}
            onRetry={() => void requests.refetch()}
          >
            {pendingRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending approvals on this page.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {pendingRows.map((row) => (
                  <li key={row.id} className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-all">{row.vendor}</span>
                    <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} />
                    <StatusBadge kind="request" status={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </QueryBody>
        </OverviewTile>

        <OverviewTile
          href={accessReviewListHref({ status: 'OPEN', projectId: id })}
          title={`Alerts (${alerts.data?.length ?? 0})`}
        >
          <QueryBody
            isPending={alerts.isPending}
            error={alerts.error}
            onRetry={() => void alerts.refetch()}
          >
            {(alerts.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No open access reviews.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {alerts.data?.map((row) => (
                  <li key={row.id} className="min-w-0 break-all">
                    {row.reason}
                  </li>
                ))}
              </ul>
            )}
          </QueryBody>
        </OverviewTile>

        <TimelinePanel
          className="md:col-span-2"
          title={
            <Link href={`/projects/${id}/activity`} className="hover:underline">
              Recent activity
            </Link>
          }
        >
          <QueryBody
            isPending={activity.isPending}
            error={activity.error}
            onRetry={() => void activity.refetch()}
          >
            <Timeline items={activityItems} />
          </QueryBody>
        </TimelinePanel>
      </div>
    </PageFlow>
  )
}
