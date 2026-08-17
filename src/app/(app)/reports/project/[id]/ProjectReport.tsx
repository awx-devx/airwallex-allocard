'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useProjectMembers } from '@/client/hooks/useMembers'
import { useProjectReport } from '@/client/hooks/useReports'
import {
  budgetHref,
  closureHref,
  exportCatalogueHref,
  memberDisplayName,
  noReportEmpty,
  parseOptionalIdParam,
  projectNotFoundMessage,
  reportToBudgetBar,
} from '@/client/lib/reports'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import type { DataTableColumn } from '@/components/patterns/types'
import { buttonVariants } from '@/components/ui/button'
import { formatDateTime } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import type { ProjectReport as ProjectReportData } from '@/shared/types/report'

type CategoryRow = ProjectReportData['byCategory'][number]
type MemberRow = ProjectReportData['byMember'][number]

const TABLE_PAGE = {
  mode: 'cursor' as const,
  nextCursor: null,
  onLoadMore: () => {},
}

export function ProjectReport() {
  const id = parseOptionalIdParam(useParams().id) ?? ''
  const report = useProjectReport(id)
  const members = useProjectMembers(id)

  if (!id) {
    return <ErrorState message={projectNotFoundMessage()} />
  }

  if (report.isPending) {
    return <LoadingState />
  }

  if (report.error) {
    if (isApiError(report.error) && report.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message={projectNotFoundMessage()} />
    }
    return (
      <ErrorState
        message={isApiError(report.error) ? report.error.message : 'Unable to load report'}
      />
    )
  }

  if (!report.data) {
    return <ErrorState message={projectNotFoundMessage()} />
  }

  const data = report.data
  const memberRows = members.data ?? []
  const empty = noReportEmpty()

  const categoryColumns: DataTableColumn<CategoryRow>[] = [
    {
      id: 'name',
      header: 'Category',
      cell: (row) => <span className="min-w-0 break-words">{row.name}</span>,
    },
    {
      id: 'allocated',
      header: 'Allocated',
      cell: (row) => (
        <MoneyDisplay
          money={{ amount: row.allocated, currency: data.currency }}
          colorBySign={false}
        />
      ),
    },
    {
      id: 'actual',
      header: 'Actual',
      cell: (row) => (
        <MoneyDisplay money={{ amount: row.actual, currency: data.currency }} colorBySign={false} />
      ),
    },
  ]

  const memberColumns: DataTableColumn<MemberRow>[] = [
    {
      id: 'member',
      header: 'Member',
      cell: (row) => (
        <span className="min-w-0 break-words">{memberDisplayName(row.userId, memberRows)}</span>
      ),
    },
    {
      id: 'actual',
      header: 'Actual',
      cell: (row) => (
        <MoneyDisplay money={{ amount: row.actual, currency: data.currency }} colorBySign={false} />
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap gap-2">
        <Link href={exportCatalogueHref({})} className={buttonVariants({ variant: 'ghost' })}>
          Back
        </Link>
        <Link href={`/projects/${id}`} className={buttonVariants({ variant: 'ghost' })}>
          Overview
        </Link>
        <Link href={budgetHref(id)} className={buttonVariants({ variant: 'ghost' })}>
          Budget
        </Link>
        <Link href={closureHref(id)} className={buttonVariants({ variant: 'ghost' })}>
          Close project
        </Link>
      </div>
      <BudgetBar {...reportToBudgetBar(data)} />
      <div className="flex min-w-0 flex-wrap gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Approved</span>
          <MoneyDisplay
            money={{ amount: data.approved, currency: data.currency }}
            colorBySign={false}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Committed</span>
          <MoneyDisplay
            money={{ amount: data.committed, currency: data.currency }}
            colorBySign={false}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Actual</span>
          <MoneyDisplay
            money={{ amount: data.actual, currency: data.currency }}
            colorBySign={false}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Remaining</span>
          <MoneyDisplay money={{ amount: data.remaining, currency: data.currency }} colorBySign />
        </div>
      </div>
      <p className="min-w-0 break-words text-sm text-muted-foreground">
        Generated {formatDateTime(data.generatedAt)}
      </p>
      <DataTable
        columns={categoryColumns}
        rows={data.byCategory}
        getRowId={(row) => row.categoryId}
        pagination={TABLE_PAGE}
        empty={empty}
      />
      <DataTable
        columns={memberColumns}
        rows={data.byMember}
        getRowId={(row) => row.userId}
        pagination={TABLE_PAGE}
        empty={empty}
      />
    </div>
  )
}
