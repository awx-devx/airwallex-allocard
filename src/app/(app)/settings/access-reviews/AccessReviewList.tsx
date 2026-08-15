'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useAccessReviews, useResolveAccessReview } from '@/client/hooks/useMembers'
import {
  accessReviewListHref,
  manageAccessReviewDenialMessage,
  parseAccessReviewSearchParams,
  peopleHref,
  permissionGateAllowed,
} from '@/client/lib/access'
import { useCan } from '@/client/lib/permissions/useCan'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/dates'
import { AccessReviewResolution, AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import { Permission } from '@/shared/enums/permissions'
import type { AccessReview } from '@/shared/types/accessReview'

const ALL = '__all__'

function ResolveActions({
  row,
  onConfirm,
  onRevoke,
}: {
  row: AccessReview
  onConfirm: () => void
  onRevoke: () => void
}) {
  const { can, isLoading } = useCan(row.projectId)
  const allowed = permissionGateAllowed(can(Permission.MEMBER_MANAGE), isLoading)
  return (
    <div className="flex flex-wrap gap-2">
      <PermissionGateView allowed={allowed} denialMessage={manageAccessReviewDenialMessage()}>
        <Button type="button" size="sm" disabled={!allowed} onClick={onConfirm}>
          Confirm
        </Button>
      </PermissionGateView>
      <PermissionGateView allowed={allowed} denialMessage={manageAccessReviewDenialMessage()}>
        <Button type="button" size="sm" variant="outline" disabled={!allowed} onClick={onRevoke}>
          Revoke
        </Button>
      </PermissionGateView>
    </div>
  )
}

export function AccessReviewList() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseAccessReviewSearchParams({
    status: params.get('status') ?? undefined,
    projectId: params.get('projectId') ?? undefined,
  })
  const query = useAccessReviews(filter)
  const resolve = useResolveAccessReview()
  const [resolveDialog, setResolveDialog] = useState<{
    open: boolean
    id: string
    resolution: typeof AccessReviewResolution.CONFIRM | typeof AccessReviewResolution.REVOKE
  } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function replaceFilter(next: typeof filter) {
    router.replace(accessReviewListHref(next))
  }

  const columns: DataTableColumn<AccessReview>[] = [
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => <span className="min-w-0 break-all">{row.reason}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => <Badge>{row.status}</Badge>,
    },
    {
      id: 'flaggedAt',
      header: 'Flagged',
      cell: (row) => formatDate(row.flaggedAt),
    },
    {
      id: 'projectId',
      header: 'Project',
      cell: (row) => (
        <Link href={peopleHref(row.projectId)} className="hover:underline">
          {row.projectId}
        </Link>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) =>
        row.status === AccessReviewStatus.OPEN ? (
          <ResolveActions
            row={row}
            onConfirm={() =>
              setResolveDialog({
                open: true,
                id: row.id,
                resolution: AccessReviewResolution.CONFIRM,
              })
            }
            onRevoke={() =>
              setResolveDialog({
                open: true,
                id: row.id,
                resolution: AccessReviewResolution.REVOKE,
              })
            }
          />
        ) : null,
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Select
          value={filter.status ?? ALL}
          onValueChange={(value) =>
            replaceFilter({
              ...filter,
              status:
                value === ALL
                  ? undefined
                  : (value as typeof AccessReviewStatus.OPEN | typeof AccessReviewStatus.RESOLVED),
            })
          }
        >
          <SelectTrigger aria-label="Status" size="sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            <SelectItem value={AccessReviewStatus.OPEN}>OPEN</SelectItem>
            <SelectItem value={AccessReviewStatus.RESOLVED}>RESOLVED</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={query.data ?? []}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: Math.max(query.data?.length ?? 0, 1),
          total: query.data?.length ?? 0,
          onPageChange: () => undefined,
        }}
        loading={query.isPending}
        error={
          query.error
            ? {
                message: isApiError(query.error)
                  ? query.error.message
                  : 'Unable to load access reviews',
                onRetry: () => void query.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No access reviews',
          description: 'Flagged access will show up here.',
        }}
      />
      <ConfirmDialog
        open={resolveDialog?.open === true}
        onOpenChange={(open) =>
          setResolveDialog((prev) => (prev === null ? prev : { ...prev, open }))
        }
        title={
          resolveDialog?.resolution === AccessReviewResolution.REVOKE
            ? 'Revoke this access?'
            : 'Confirm this access?'
        }
        description={
          resolveDialog?.resolution === AccessReviewResolution.REVOKE
            ? 'This member will lose the flagged access.'
            : 'This access will stay in place.'
        }
        confirmLabel={
          resolveDialog?.resolution === AccessReviewResolution.REVOKE ? 'Revoke' : 'Confirm'
        }
        variant={
          resolveDialog?.resolution === AccessReviewResolution.REVOKE ? 'destructive' : 'default'
        }
        loading={resolve.isPending}
        onConfirm={() => {
          if (resolveDialog === null) return
          const next = resolveDialog
          setResolveDialog((prev) => (prev === null ? prev : { ...prev, open: false }))
          setActionError(null)
          void resolve
            .mutateAsync({ id: next.id, input: { resolution: next.resolution } })
            .catch((error: unknown) => {
              setActionError(isApiError(error) ? error.message : 'Unable to resolve review')
            })
        }}
      />
    </div>
  )
}
