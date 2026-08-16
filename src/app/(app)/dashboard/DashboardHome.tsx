'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useActivity } from '@/client/hooks/useReports'
import { useApprovalCount, useApprovals } from '@/client/hooks/useRequests'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import {
  activeOrgRole,
  canCreateProject,
  createProjectDenialMessage,
  draftWizardHref,
  toTimelineItem,
} from '@/client/lib/projects'
import { approvalHref } from '@/client/lib/requests'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState, shouldShowErrorRetry } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Timeline } from '@/components/patterns/Timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { ErrorCode } from '@/shared/enums/errors'

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

function CreateProjectControl() {
  const me = useMe()
  const permissions = usePermissions()
  const { orgId } = useActiveOrg()
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed =
    me.isPending || permissions.isPending || canCreateProject({ orgRole, me: permissions.data })

  return (
    <PermissionGateView allowed={allowed} denialMessage={createProjectDenialMessage()}>
      {allowed ? (
        <Button asChild>
          <Link href="/projects/new">Create project</Link>
        </Button>
      ) : (
        <Button type="button" disabled>
          Create project
        </Button>
      )}
    </PermissionGateView>
  )
}

export function DashboardHome() {
  const active = useProjects({
    status: ProjectStatus.ACTIVE,
    page: 1,
    pageSize: 6,
    sort: '-updatedAt',
  })
  const drafts = useProjects({
    status: ProjectStatus.DRAFT,
    page: 1,
    pageSize: 5,
    sort: '-updatedAt',
  })
  const pendingProjects = useProjects({
    status: ProjectStatus.PENDING_APPROVAL,
    page: 1,
    pageSize: 5,
    sort: '-updatedAt',
  })
  const approvalCount = useApprovalCount()
  const approvals = useApprovals({ page: 1, pageSize: 5 })
  const activity = useActivity({ limit: 8 })

  const activityItems = (activity.data?.pages[0]?.items ?? []).map(toTimelineItem)
  const count = approvalCount.data?.count ?? 0

  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <Link href="/projects?status=ACTIVE" className="hover:underline">
              Active projects
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QueryBody
            isPending={active.isPending}
            error={active.error}
            onRetry={() => void active.refetch()}
          >
            {active.data?.items.length === 0 ? (
              <div className="flex flex-col items-center">
                <EmptyState
                  title="No projects yet"
                  description="Create a project to get started."
                />
                <CreateProjectControl />
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {active.data?.items.map((project) => (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex min-w-0 flex-wrap items-center gap-2 hover:underline"
                    >
                      <span className="min-w-0 break-all">{project.name}</span>
                      <span className="text-sm text-muted-foreground">{project.code}</span>
                      <StatusBadge kind="project" status={project.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </QueryBody>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <Link href="/approvals" className="hover:underline">
              Pending approvals ({count})
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QueryBody
            isPending={approvals.isPending || approvalCount.isPending}
            error={approvals.error ?? approvalCount.error}
            onRetry={() => {
              void approvals.refetch()
              void approvalCount.refetch()
            }}
          >
            <ul className="flex flex-col gap-2">
              {approvals.data?.items.map((request) => (
                <li key={request.id}>
                  <Link
                    href={approvalHref(request.id)}
                    className="flex min-w-0 flex-wrap items-center gap-2 hover:underline"
                  >
                    <span className="min-w-0 break-all">{request.vendor}</span>
                    <MoneyDisplay money={{ amount: request.amount, currency: request.currency }} />
                    <StatusBadge kind="request" status={request.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </QueryBody>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <Link href="/activity" className="hover:underline">
              Recent activity
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QueryBody
            isPending={activity.isPending}
            error={activity.error}
            onRetry={() => void activity.refetch()}
          >
            <Timeline items={activityItems} />
          </QueryBody>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>
            <Link href="/projects?status=DRAFT" className="hover:underline">
              Alerts
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QueryBody
            isPending={drafts.isPending || pendingProjects.isPending}
            error={drafts.error ?? pendingProjects.error}
            onRetry={() => {
              void drafts.refetch()
              void pendingProjects.refetch()
            }}
          >
            <ul className="flex flex-col gap-2">
              {drafts.data?.items.map((project) => (
                <li key={project.id}>
                  <Link
                    href={draftWizardHref(project.id)}
                    className="flex min-w-0 flex-wrap items-center gap-2 hover:underline"
                  >
                    <span className="min-w-0 break-all">{project.name}</span>
                    <span className="text-sm text-muted-foreground">{project.code}</span>
                    <span>Resume</span>
                  </Link>
                </li>
              ))}
              {pendingProjects.data?.items.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex min-w-0 flex-wrap items-center gap-2 hover:underline"
                  >
                    <span className="min-w-0 break-all">{project.name}</span>
                    <span className="text-sm text-muted-foreground">{project.code}</span>
                    <StatusBadge kind="project" status={project.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </QueryBody>
        </CardContent>
      </Card>
    </div>
  )
}
