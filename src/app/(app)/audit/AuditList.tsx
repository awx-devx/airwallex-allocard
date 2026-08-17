'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useAudit } from '@/client/hooks/useReports'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { activeOrgRole } from '@/client/lib/projects'
import {
  auditListHref,
  cardHref,
  holdsMemberManage,
  noAuditEmpty,
  parseAuditSearchParams,
  transactionHref,
  viewAuditDenialMessage,
  type AuditListSearch,
} from '@/client/lib/reports'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import type { AuditFilter } from '@/client/queryKeys'
import { DataTable } from '@/components/patterns/DataTable'
import { DiffView } from '@/components/patterns/DiffView'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { timelineActorChipLabel } from '@/components/patterns/timelineActor'
import type { DataTableColumn } from '@/components/patterns/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/dates'
import type { AuditEntry } from '@/shared/types/auditQuery'

const ALL = '__all__'

function toAuditFilter(filter: AuditListSearch): AuditFilter {
  const next: AuditFilter = { limit: 20 }
  if (filter.subjectType !== undefined) next.subjectType = filter.subjectType
  if (filter.subjectId !== undefined) next.subjectId = filter.subjectId
  if (filter.actorId !== undefined) next.actorId = filter.actorId
  if (filter.action !== undefined) next.action = filter.action
  if (filter.projectId !== undefined) next.projectId = filter.projectId
  if (filter.from !== undefined) next.from = filter.from
  if (filter.to !== undefined) next.to = filter.to
  return next
}

function AuditToolbar({
  filter,
  projectItems,
  onChange,
}: {
  filter: AuditListSearch
  projectItems: ReadonlyArray<{ id: string; name: string }>
  onChange: (next: AuditListSearch) => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Project</Label>
        <Select
          value={filter.projectId ?? ALL}
          onValueChange={(value) =>
            onChange({
              ...filter,
              projectId: value === ALL ? undefined : value,
            })
          }
        >
          <SelectTrigger aria-label="Project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {projectItems.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Subject type</Label>
        <Input
          value={filter.subjectType ?? ''}
          onChange={(event) =>
            onChange({
              ...filter,
              subjectType: event.target.value.length >= 1 ? event.target.value : undefined,
            })
          }
          aria-label="Subject type"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Subject id</Label>
        <Input
          value={filter.subjectId ?? ''}
          onChange={(event) =>
            onChange({
              ...filter,
              subjectId: event.target.value.length >= 1 ? event.target.value : undefined,
            })
          }
          aria-label="Subject id"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Actor id</Label>
        <Input
          value={filter.actorId ?? ''}
          onChange={(event) =>
            onChange({
              ...filter,
              actorId: event.target.value.length >= 1 ? event.target.value : undefined,
            })
          }
          aria-label="Actor id"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Action</Label>
        <Input
          value={filter.action ?? ''}
          onChange={(event) =>
            onChange({
              ...filter,
              action: event.target.value.length >= 1 ? event.target.value : undefined,
            })
          }
          aria-label="Action"
        />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Dates</Label>
        <DateRangePicker
          from={filter.from ?? null}
          to={filter.to ?? null}
          onChange={({ from, to }) =>
            onChange({
              ...filter,
              from: from ?? undefined,
              to: to ?? undefined,
            })
          }
        />
      </div>
    </div>
  )
}

export function AuditList() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseAuditSearchParams({
    subjectType: params.get('subjectType') ?? undefined,
    subjectId: params.get('subjectId') ?? undefined,
    actorId: params.get('actorId') ?? undefined,
    action: params.get('action') ?? undefined,
    projectId: params.get('projectId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })
  const me = useMe()
  const permissions = usePermissions()
  const { orgId } = useActiveOrg()
  const projects = useProjects({ page: 1, pageSize: 100 })
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const canView =
    me.isPending || permissions.isPending || holdsMemberManage(orgRole, permissions.data?.projects)

  function replaceFilter(next: AuditListSearch) {
    router.replace(auditListHref(next))
  }

  const toolbar = (
    <AuditToolbar
      filter={filter}
      projectItems={projects.data?.items ?? []}
      onChange={replaceFilter}
    />
  )

  if (me.isPending || permissions.isPending) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <LoadingState />
      </div>
    )
  }

  if (!canView) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <PermissionGateView allowed={false} denialMessage={viewAuditDenialMessage()}>
          <p className="text-sm text-muted-foreground">{viewAuditDenialMessage()}</p>
        </PermissionGateView>
      </div>
    )
  }

  return <AuditListResults filter={filter} toolbar={toolbar} />
}

function AuditListResults({ filter, toolbar }: { filter: AuditListSearch; toolbar: ReactNode }) {
  const query = useAudit(toAuditFilter(filter))
  const rows = (query.data?.pages ?? []).flatMap((page) => page.items)
  const [diffRow, setDiffRow] = useState<AuditEntry | null>(null)
  const empty = noAuditEmpty()

  if (query.error) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <ErrorState
          message={isApiError(query.error) ? query.error.message : 'Unable to load audit'}
        />
      </div>
    )
  }

  if (!query.isPending && !query.hasNextPage && rows.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} />
      </div>
    )
  }

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      id: 'at',
      header: 'When',
      cell: (row) => formatDateTime(row.at),
    },
    {
      id: 'actorType',
      header: 'Actor',
      cell: (row) => (
        <Badge variant="outline">{timelineActorChipLabel(row.actorType, undefined)}</Badge>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => (
        <span className="min-w-0 break-words" title={row.action}>
          {row.action}
        </span>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      cell: (row) => {
        const label = `${row.subjectType} ${row.subjectId}`
        if (row.subjectType === 'card') {
          return (
            <Link href={cardHref(row.subjectId)} className="min-w-0 break-words hover:underline">
              {label}
            </Link>
          )
        }
        if (row.subjectType === 'transaction') {
          return (
            <Link
              href={transactionHref(row.subjectId)}
              className="min-w-0 break-words hover:underline"
            >
              {label}
            </Link>
          )
        }
        return <span className="min-w-0 break-words">{label}</span>
      },
    },
    {
      id: 'diff',
      header: 'Diff',
      cell: (row) => (
        <Button type="button" size="sm" variant="outline" onClick={() => setDiffRow(row)}>
          Diff
        </Button>
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {toolbar}
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'cursor',
          nextCursor: query.hasNextPage ? 'next' : null,
          onLoadMore: () => {
            void query.fetchNextPage()
          },
          isFetchingMore: query.isFetchingNextPage,
        }}
        loading={query.isPending}
        empty={empty}
      />
      <Sheet open={diffRow !== null} onOpenChange={(open) => !open && setDiffRow(null)}>
        <SheetContent side="right" className="min-w-0 overflow-y-auto">
          {diffRow ? (
            <>
              <SheetHeader>
                <SheetTitle className="min-w-0 break-words">
                  {diffRow.action}{' '}
                  <Badge variant="outline">
                    {timelineActorChipLabel(diffRow.actorType, undefined)}
                  </Badge>
                </SheetTitle>
              </SheetHeader>
              <div className="flex min-w-0 flex-col gap-4">
                <DiffView before={diffRow.before} after={diffRow.after} />
                <pre className="min-w-0 break-all text-xs">
                  {JSON.stringify(diffRow.metadata, null, 2)}
                </pre>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
