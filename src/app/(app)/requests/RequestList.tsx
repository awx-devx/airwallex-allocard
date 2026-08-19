'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { FileTextIcon, PlusIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useRequests } from '@/client/hooks/useRequests'
import { useMe } from '@/client/hooks/useSession'
import { useCan } from '@/client/lib/permissions/useCan'
import { archivedProjectMessage, isProjectArchived } from '@/client/lib/reports'
import {
  createRequestDenialMessage,
  listPolicyLabel,
  listRequestsDenialMessage,
  newRequestHref,
  noRequestsEmpty,
  parseRequestListSearchParams,
  requestHref,
  requestListHref,
  selectProjectEmpty,
} from '@/client/lib/requests'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FilterBar, FilterSelect } from '@/components/patterns/FilterSelect'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFill } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { SelectItem } from '@/components/ui/select'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { PurchaseRequest } from '@/shared/types/purchaseRequest'

function NewRequestControl({ projectId }: { projectId: string }) {
  const me = useMe()
  const { can, isLoading } = useCan(projectId)
  const viewerId = me.data?.user.id
  const ready = !isLoading && !me.isPending && viewerId !== undefined && viewerId.length >= 1
  const allowed = ready && can(Permission.PAYMENT_MAKE, { userId: viewerId })
  if (!ready) {
    return (
      <Button type="button" disabled>
        <PlusIcon className="size-4 shrink-0" aria-hidden />
        New request
      </Button>
    )
  }
  return (
    <PermissionGateView allowed={allowed} denialMessage={createRequestDenialMessage()}>
      {allowed ? (
        <Button asChild>
          <Link href={newRequestHref(projectId)}>
            <PlusIcon className="size-4 shrink-0" aria-hidden />
            New request
          </Link>
        </Button>
      ) : (
        <Button type="button" disabled>
          <PlusIcon className="size-4 shrink-0" aria-hidden />
          New request
        </Button>
      )}
    </PermissionGateView>
  )
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
    <FilterSelect
      label="Project"
      value={value}
      onValueChange={onChange}
      placeholder="Select a project"
    >
      {items.map((project) => (
        <SelectItem key={project.id} value={project.id}>
          {project.name}
        </SelectItem>
      ))}
    </FilterSelect>
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
      <PageFill>
        <FilterBar>{projectSelect}</FilterBar>
        <EmptyState title={empty.title} description={empty.description} />
      </PageFill>
    )
  }

  const archived = isProjectArchived(
    projectItems.find((row) => row.id === filter.projectId)?.status ?? '',
  )

  return (
    <RequestListForProject
      projectId={filter.projectId}
      page={filter.page}
      pageSize={filter.pageSize}
      archived={archived}
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
  archived,
  projectSelect,
  onPageChange,
}: {
  projectId: string
  page: number
  pageSize: number
  archived: boolean
  projectSelect: ReactNode
  onPageChange: (page: number) => void
}) {
  const query = useRequests(projectId, { page, pageSize })
  const newControl = archived ? null : <NewRequestControl projectId={projectId} />
  const toolbar = (
    <FilterBar>
      {projectSelect}
      {newControl}
    </FilterBar>
  )
  const archivedAlert = archived ? (
    <Alert>
      <AlertDescription>{archivedProjectMessage()}</AlertDescription>
    </Alert>
  ) : null

  if (query.isPending) {
    return (
      <PageFill>
        {toolbar}
        {archivedAlert}
        <LoadingState />
      </PageFill>
    )
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return (
        <PageFill>
          {toolbar}
          {archivedAlert}
          <ErrorState message="This project is not available." />
        </PageFill>
      )
    }
    if (isApiError(query.error) && query.error.code === ErrorCode.PERMISSION_DENIED) {
      return (
        <PageFill>
          {toolbar}
          {archivedAlert}
          <ErrorState message={listRequestsDenialMessage()} />
        </PageFill>
      )
    }
    return (
      <PageFill>
        {toolbar}
        {archivedAlert}
        <ErrorState
          message={isApiError(query.error) ? query.error.message : 'Unable to load requests'}
        />
      </PageFill>
    )
  }

  if (query.data.total === 0) {
    const empty = noRequestsEmpty()
    return (
      <PageFill>
        {toolbar}
        {archivedAlert}
        <EmptyState
          title={empty.title}
          description={empty.description}
          illustration={<FileTextIcon className="size-8 text-muted-foreground" aria-hidden />}
        />
      </PageFill>
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
        const label = listPolicyLabel(row.status, row.policyDecision)
        return (
          <span className="min-w-0" title={label.title}>
            {label.text}
          </span>
        )
      },
    },
  ]

  return (
    <PageFill>
      {toolbar}
      {archivedAlert}
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
    </PageFill>
  )
}
