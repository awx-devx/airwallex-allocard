'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useMe } from '@/client/hooks/useSession'
import { useDeclinedTransactions } from '@/client/hooks/useTransactions'
import { activeOrgRole } from '@/client/lib/projects'
import {
  billedAsLabel,
  billingDiffers,
  cardExplainHref,
  declineReason,
  declinedListHref,
  flattenTransactionPages,
  noDeclinedEmpty,
  parseDeclinedSearchParams,
  requiresProjectIdOnTxList,
  selectProjectEmpty,
  transactionHref,
  transactionListHref,
  whyThisLimitLink,
  type DeclinedListSearch,
} from '@/client/lib/transactions'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import type { DeclinedTxFilter } from '@/client/queryKeys'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FilterBar, FilterSelect } from '@/components/patterns/FilterSelect'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFill } from '@/components/patterns/PageBody'
import { buttonVariants } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import { SelectItem } from '@/components/ui/select'
import { formatDateTime } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Transaction } from '@/shared/types/transaction'

const ALL = '__all__'

function toDeclinedFilter(filter: DeclinedListSearch): DeclinedTxFilter {
  const next: Partial<DeclinedTxFilter> = { pageSize: 20 }
  if (filter.projectId !== undefined) next.projectId = filter.projectId
  if (filter.cardId !== undefined) next.cardId = filter.cardId
  if (filter.from !== undefined) next.from = filter.from
  if (filter.to !== undefined) next.to = filter.to
  // Infinite query supplies `page` via pageParam. Do not send status.
  return next as DeclinedTxFilter
}

function DeclinedToolbar({
  filter,
  projectItems,
  allowAllProjects,
  onChange,
}: {
  filter: DeclinedListSearch
  projectItems: ReadonlyArray<{ id: string; name: string }>
  allowAllProjects: boolean
  onChange: (next: DeclinedListSearch) => void
}) {
  return (
    <FilterBar>
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
        href={transactionListHref({ projectId: filter.projectId })}
        className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit')}
      >
        Back
      </Link>
    </FilterBar>
  )
}

export function DeclinedList() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseDeclinedSearchParams({
    projectId: params.get('projectId') ?? undefined,
    cardId: params.get('cardId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })
  const me = useMe()
  const { orgId } = useActiveOrg()
  const projects = useProjects({ page: 1, pageSize: 100 })
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const needsProject = requiresProjectIdOnTxList(orgRole)

  function pushFilter(next: DeclinedListSearch) {
    router.push(declinedListHref(next))
  }

  const toolbar = (
    <DeclinedToolbar
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

  return <DeclinedListResults filter={filter} toolbar={toolbar} />
}

function DeclinedListResults({
  filter,
  toolbar,
}: {
  filter: DeclinedListSearch
  toolbar: ReactNode
}) {
  const query = useDeclinedTransactions(toDeclinedFilter(filter))
  const rows = flattenTransactionPages(query.data?.pages) as Transaction[]

  if (query.error) {
    return (
      <PageFill>
        {toolbar}
        <ErrorState
          message={isApiError(query.error) ? query.error.message : 'Unable to load declines'}
        />
      </PageFill>
    )
  }

  if (!query.isPending && !query.hasNextPage && rows.length === 0) {
    const empty = noDeclinedEmpty()
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
      id: 'reason',
      header: 'Reason',
      cell: (row) => {
        const reason = declineReason(row.failureReason)
        return (
          <span className="min-w-0 break-words" title={reason}>
            {reason}
          </span>
        )
      },
    },
    {
      id: 'explain',
      header: 'Limit',
      cell: (row) => (
        <Link href={cardExplainHref(row.cardId)} className="min-w-0 break-words hover:underline">
          {whyThisLimitLink()}
        </Link>
      ),
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
        empty={noDeclinedEmpty()}
      />
    </PageFill>
  )
}
