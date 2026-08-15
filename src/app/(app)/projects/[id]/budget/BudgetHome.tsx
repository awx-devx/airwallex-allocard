'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget, useBudgetChangeRequests, useBudgetEntries } from '@/client/hooks/useBudget'
import { useMe } from '@/client/hooks/useSession'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  budgetRequestsHref,
  editBudgetDenialMessage,
  hasBudgetRecord,
  overCommittedMessage,
  pendingChangeRequests,
  projectionToBudgetBarProps,
} from '@/client/lib/budget'
import { useCan } from '@/client/lib/permissions/useCan'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { BudgetEntry } from '@/shared/types/budget'

const ENTRY_PAGE_SIZE = 20

export function BudgetHome() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const [page, setPage] = useState(1)
  const budgetQuery = useBudget(id)
  const me = useMe()
  const changeRequests = useBudgetChangeRequests(id)
  const entries = useBudgetEntries(id, { page, pageSize: ENTRY_PAGE_SIZE })
  const { can, isLoading } = useCan(id)

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (budgetQuery.isPending) {
    return <LoadingState />
  }

  if (budgetQuery.error) {
    if (isApiError(budgetQuery.error) && budgetQuery.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={
          isApiError(budgetQuery.error) ? budgetQuery.error.message : 'Unable to load budget'
        }
      />
    )
  }

  const detail = budgetQuery.data
  const canEdit = permissionGateAllowed(can(Permission.BUDGET_EDIT), isLoading)

  if (!detail || !hasBudgetRecord(detail.budget) || detail.budget === null) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <EmptyState
          title="No budget set yet"
          description="Set an approved amount. Categories and formulas come next."
        />
        {/* TODO(A4.3) Set budget PUT */}
        <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
          <Button type="button" disabled>
            Set budget lands in A4.3.
          </Button>
        </PermissionGateView>
      </div>
    )
  }

  const currency = detail.budget.currency ?? me.data?.activeOrg?.baseCurrency
  if (!currency) {
    return <LoadingState />
  }

  const projection = detail.projection
  const pending = pendingChangeRequests(changeRequests.data ?? [])
  const overCommitted = projection.overCommitted || projection.remaining < 0

  const columns: DataTableColumn<BudgetEntry>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <Badge variant="outline">{row.type}</Badge>,
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} />,
    },
    {
      id: 'sourceType',
      header: 'Source',
      cell: (row) => row.sourceType,
    },
    {
      id: 'note',
      header: 'Note',
      cell: (row) => row.note ?? '—',
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <BudgetBar {...projectionToBudgetBarProps(projection, currency)} />
      {overCommitted ? (
        <Alert variant="destructive">
          <AlertDescription>{overCommittedMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {pending.length > 0 ? (
        <Alert>
          <AlertDescription>
            <p>A budget change is pending.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {pending.map((row) => (
                <li key={row.id} className="flex min-w-0 flex-wrap items-center gap-2">
                  <MoneyDisplay money={{ amount: row.deltaAmount, currency }} />
                  <span className="min-w-0 truncate" title={row.reason}>
                    {row.reason}
                  </span>
                  <Link
                    href={budgetRequestsHref(id)}
                    className="underline-offset-4 hover:underline"
                  >
                    Review requests
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {/* TODO(A4.3) Set approved / Record adjustment / Request change */}
        <Button type="button" disabled>
          Set approved
        </Button>
        <Button type="button" disabled>
          Record adjustment
        </Button>
        <Button type="button" disabled>
          Request change
        </Button>
      </div>
      <h2 className="text-sm font-medium">Recent entries</h2>
      <DataTable
        columns={columns}
        rows={entries.data?.items ?? []}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: entries.data?.page ?? page,
          pageSize: entries.data?.pageSize ?? ENTRY_PAGE_SIZE,
          total: entries.data?.total ?? 0,
          onPageChange: setPage,
        }}
        loading={entries.isPending}
        error={
          entries.error
            ? {
                message: isApiError(entries.error)
                  ? entries.error.message
                  : 'Unable to load entries',
                onRetry: () => void entries.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No ledger entries yet',
          description: 'Approvals, commitments, actuals, and adjustments appear here.',
        }}
      />
    </div>
  )
}
