'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useRequests } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { useCan } from '@/client/lib/permissions/useCan'
import {
  createRequestDenialMessage,
  formatApprovalRequired,
  listRequestsDenialMessage,
  newRequestHref,
  noRequestsEmpty,
  parseRequestListSearchParams,
  policyPreviewHeading,
  requestHref,
  requestListHref,
  selectProjectEmpty,
} from '@/client/lib/requests'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { DataTableColumn } from '@/components/patterns/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import type { PolicyDecision, PurchaseRequest } from '@/shared/types/purchaseRequest'

function NewRequestControl({ projectId }: { projectId: string }) {
  const me = useMe()
  const { can, isLoading } = useCan(projectId)
  const viewerId = me.data?.user.id
  const ready = !isLoading && !me.isPending && viewerId !== undefined && viewerId.length >= 1
  const allowed = ready && can(Permission.PAYMENT_MAKE, { userId: viewerId })
  if (!ready) {
    return (
      <Button type="button" disabled>
        New request
      </Button>
    )
  }
  return (
    <PermissionGateView allowed={allowed} denialMessage={createRequestDenialMessage()}>
      {allowed ? (
        <Button asChild>
          <Link href={newRequestHref(projectId)}>New request</Link>
        </Button>
      ) : (
        <Button type="button" disabled>
          New request
        </Button>
      )}
    </PermissionGateView>
  )
}

function policyLabel(decision: PolicyDecision | null): { text: string; title?: string } {
  if (decision === null) {
    return { text: '—' }
  }
  if (decision.outcome === PolicyOutcome.NOT_PERMITTED) {
    return {
      text: decision.reasons[0] ?? policyPreviewHeading(decision.outcome),
      title: decision.reasons.join('\n'),
    }
  }
  if (decision.outcome === PolicyOutcome.APPROVAL_REQUIRED) {
    return { text: formatApprovalRequired(decision.requiredApprovals) }
  }
  return { text: policyPreviewHeading(decision.outcome) || '—' }
}

function ProjectSelect({
  value,
  items,
  onChange,
}: {
  value: string | undefined
  items: ReadonlyArray<{ id: string; name: string }>
  onChange: (projectId: string) => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label className="text-xs text-muted-foreground">Project</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label="Project">
          <SelectValue placeholder="Select a project" />
        </SelectTrigger>
        <SelectContent>
          {items.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function RequestList() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseRequestListSearchParams({
    projectId: params.get('projectId') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const projects = useProjects({ page: 1, pageSize: 100 })
  const projectItems = projects.data?.items ?? []

  function pushProject(projectId: string) {
    router.push(requestListHref({ projectId, page: 1, pageSize: filter.pageSize }))
  }

  const projectSelect = (
    <ProjectSelect value={filter.projectId} items={projectItems} onChange={pushProject} />
  )

  if (filter.projectId === undefined) {
    const empty = selectProjectEmpty()
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap gap-2">{projectSelect}</div>
        <EmptyState title={empty.title} description={empty.description} />
      </div>
    )
  }

  return (
    <RequestListForProject
      projectId={filter.projectId}
      page={filter.page}
      pageSize={filter.pageSize}
      projectSelect={projectSelect}
      onPageChange={(page) =>
        router.push(
          requestListHref({ projectId: filter.projectId, page, pageSize: filter.pageSize }),
        )
      }
    />
  )
}

function RequestListForProject({
  projectId,
  page,
  pageSize,
  projectSelect,
  onPageChange,
}: {
  projectId: string
  page: number
  pageSize: number
  projectSelect: ReactNode
  onPageChange: (page: number) => void
}) {
  const query = useRequests(projectId, { page, pageSize })
  const newControl = <NewRequestControl projectId={projectId} />
  const toolbar = (
    <div className="flex flex-wrap gap-2">
      {projectSelect}
      {newControl}
    </div>
  )

  if (query.isPending) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <LoadingState />
      </div>
    )
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return (
        <div className="flex min-w-0 flex-col gap-4">
          {toolbar}
          <ErrorState message="This project is not available." />
        </div>
      )
    }
    if (isApiError(query.error) && query.error.code === ErrorCode.PERMISSION_DENIED) {
      return (
        <div className="flex min-w-0 flex-col gap-4">
          {toolbar}
          <ErrorState message={listRequestsDenialMessage()} />
        </div>
      )
    }
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <ErrorState
          message={isApiError(query.error) ? query.error.message : 'Unable to load requests'}
        />
      </div>
    )
  }

  if (query.data.total === 0) {
    const empty = noRequestsEmpty()
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} />
      </div>
    )
  }

  const columns: DataTableColumn<PurchaseRequest>[] = [
    {
      id: 'vendor',
      header: 'Vendor',
      cell: (row) => (
        <Link href={requestHref(row.id)} className="min-w-0 hover:underline">
          {row.vendor}
        </Link>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} />,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge kind="request" status={row.status} />,
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
    },
    {
      id: 'policy',
      header: 'Policy',
      cell: (row) => {
        const label = policyLabel(row.policyDecision)
        return (
          <span className="min-w-0" title={label.title}>
            {label.text}
          </span>
        )
      },
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {toolbar}
      <DataTable
        columns={columns}
        rows={query.data.items}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: query.data.page,
          pageSize: query.data.pageSize,
          total: query.data.total,
          onPageChange,
        }}
        empty={noRequestsEmpty()}
      />
    </div>
  )
}
