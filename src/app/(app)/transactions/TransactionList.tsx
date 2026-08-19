'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useMe } from '@/client/hooks/useSession'
import { useTransactions } from '@/client/hooks/useTransactions'
import { activeOrgRole } from '@/client/lib/projects'
import {
  billedAsLabel,
  billingDiffers,
  declinedListHref,
  flattenTransactionPages,
  noTransactionsEmpty,
  parseTransactionListSearchParams,
  receiptsListHref,
  requiresProjectIdOnTxList,
  selectProjectEmpty,
  transactionHref,
  transactionListHref,
  transactionStatusLabel,
  transactionTypeLabel,
  type TransactionListSearch,
} from '@/client/lib/transactions'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import type { TxFilter } from '@/client/queryKeys'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FilterSelect } from '@/components/patterns/FilterSelect'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFill } from '@/components/patterns/PageBody'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import { SelectItem } from '@/components/ui/select'
import { formatDateTime } from '@/lib/dates'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import type { Transaction } from '@/shared/types/transaction'

const ALL = '__all__'

function toListFilter(filter: TransactionListSearch): TxFilter {
  const next: Partial<TxFilter> = { pageSize: 20 }
  if (filter.projectId !== undefined) next.projectId = filter.projectId
  if (filter.cardId !== undefined) next.cardId = filter.cardId
  if (filter.status !== undefined) next.status = filter.status
  if (filter.from !== undefined) next.from = filter.from
  if (filter.to !== undefined) next.to = filter.to
  // Infinite query supplies `page` via pageParam; do not put it in the filter.
  return next as TxFilter
}

function TransactionToolbar({
  filter,
  projectItems,
  allowAllProjects,
  onChange,
}: {
  filter: TransactionListSearch
  projectItems: ReadonlyArray<{ id: string; name: string }>
  allowAllProjects: boolean
  onChange: (next: TransactionListSearch) => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <FilterSelect
        label="Project"
        value={filter.projectId ?? (allowAllProjects ? ALL : undefined)}
        onValueChange={(value) =>
          onChange({
            ...filter,
            projectId: value === ALL ? undefined : value,
          })
        }
        allLabel={allowAllProjects ? 'All projects' : undefined}
        placeholder={allowAllProjects ? 'All projects' : 'Select a project'}
      >
        {projectItems.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </FilterSelect>
      <FilterSelect
        label="Status"
        value={filter.status ?? ALL}
        onValueChange={(value) =>
          onChange({
            ...filter,
            status: value === ALL ? undefined : (value as TransactionStatus),
          })
        }
        allLabel="All statuses"
      >
        {Object.values(TransactionStatus).map((status) => (
          <SelectItem key={status} value={status}>
            {transactionStatusLabel(status)}
          </SelectItem>
        ))}
      </FilterSelect>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs font-medium text-muted-foreground">Dates</Label>
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
      <Link
        href={declinedListHref({ projectId: filter.projectId })}
        className={buttonVariants({ variant: 'ghost' })}
      >
        Declines
      </Link>
      <Link
        href={receiptsListHref({ projectId: filter.projectId })}
        className={buttonVariants({ variant: 'ghost' })}
      >
        Receipts
      </Link>
    </div>
  )
}

export function TransactionList() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseTransactionListSearchParams({
    projectId: params.get('projectId') ?? undefined,
    cardId: params.get('cardId') ?? undefined,
    status: params.get('status') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })
  const me = useMe()
  const { orgId } = useActiveOrg()
  const projects = useProjects({ page: 1, pageSize: 100 })
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const needsProject = requiresProjectIdOnTxList(orgRole)

  function pushFilter(next: TransactionListSearch) {
    router.push(transactionListHref(next))
  }

  const toolbar = (
    <TransactionToolbar
      filter={filter}
      projectItems={projects.data?.items ?? []}
      allowAllProjects={!needsProject && !me.isPending}
      onChange={pushFilter}
    />
  )

  if (me.isPending) {
    return (
      <PageFill>
        {toolbar}
        <LoadingState />
      </PageFill>
    )
  }

  if (needsProject && filter.projectId === undefined) {
    const empty = selectProjectEmpty()
    return (
      <PageFill>
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} />
      </PageFill>
    )
  }

  return <TransactionListResults filter={filter} toolbar={toolbar} />
}

function TransactionListResults({
  filter,
  toolbar,
}: {
  filter: TransactionListSearch
  toolbar: ReactNode
}) {
  const query = useTransactions(toListFilter(filter))
  const rows = flattenTransactionPages(query.data?.pages) as Transaction[]

  if (query.error) {
    return (
      <PageFill>
        {toolbar}
        <ErrorState
          message={isApiError(query.error) ? query.error.message : 'Unable to load transactions'}
        />
      </PageFill>
    )
  }

  if (!query.isPending && !query.hasNextPage && rows.length === 0) {
    const empty = noTransactionsEmpty()
    return (
      <PageFill>
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} />
      </PageFill>
    )
  }

  const columns: DataTableColumn<Transaction>[] = [
    {
      id: 'transactedAt',
      header: 'Date',
      cell: (row) => formatDateTime(row.transactedAt),
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
      cell: (row) => <Badge variant="outline">{transactionStatusLabel(row.status)}</Badge>,
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => transactionTypeLabel(row.type),
    },
  ]

  return (
    <PageFill>
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
        empty={noTransactionsEmpty()}
      />
    </PageFill>
  )
}
