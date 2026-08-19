'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useProjectMembers } from '@/client/hooks/useMembers'
import { useFinalReport } from '@/client/hooks/useReports'
import {
  auditListHref,
  budgetHref,
  finalReportMissingMessage,
  memberDisplayName,
  parseOptionalIdParam,
  projectNotFoundMessage,
  projectReportHref,
  reportToBudgetBar,
  viewInAuditLink,
} from '@/client/lib/reports'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { DataTable } from '@/components/patterns/DataTable'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFlow } from '@/components/patterns/PageBody'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import type { FinalReport as FinalReportData } from '@/shared/types/report'

type CategoryRow = FinalReportData['byCategory'][number]
type MemberRow = FinalReportData['byMember'][number]

const TABLE_PAGE = {
  mode: 'cursor' as const,
  nextCursor: null,
  onLoadMore: () => {},
}

export function FinalReport() {
  const id = parseOptionalIdParam(useParams().id) ?? ''
  const report = useFinalReport(id)
  const members = useProjectMembers(id)

  if (!id) {
    return <ErrorState message={projectNotFoundMessage()} />
  }

  if (report.isPending) {
    return <LoadingState />
  }

  if (report.error) {
    if (isApiError(report.error) && report.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message={finalReportMissingMessage()} />
    }
    return (
      <ErrorState
        message={isApiError(report.error) ? report.error.message : 'Unable to load final report'}
      />
    )
  }

  if (!report.data) {
    return <ErrorState message={finalReportMissingMessage()} />
  }

  const data = report.data
  const memberRows = members.data ?? []

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
    <PageFlow>
      <div className="flex min-w-0 flex-wrap gap-2">
        <Link href={budgetHref(id)} className={buttonVariants({ variant: 'ghost' })}>
          Budget
        </Link>
        <Link href={projectReportHref(id)} className={buttonVariants({ variant: 'ghost' })}>
          Project
        </Link>
        <Link
          href={auditListHref({ projectId: id })}
          className={buttonVariants({ variant: 'ghost' })}
        >
          {viewInAuditLink()}
        </Link>
      </div>
      <PageHeader title="Final report" />
      <Card className="laser-cap">
        <CardHeader>
          <CardTitle>Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <BudgetBar {...reportToBudgetBar(data)} />
        </CardContent>
      </Card>
      <div className="flex min-w-0 flex-wrap gap-4 text-sm">
        <span className="min-w-0 break-words">Closed {formatDateTime(data.closedAt)}</span>
        <span className="min-w-0 break-words">
          Archived {data.archivedAt ? formatDateTime(data.archivedAt) : '—'}
        </span>
        <span className="min-w-0 break-words">Transactions {data.transactionCount}</span>
        <span className="min-w-0 break-words">Access history {data.accessHistoryCount}</span>
      </div>
      {data.byCategory.length > 0 ? (
        <DataTable
          columns={categoryColumns}
          rows={data.byCategory}
          getRowId={(row) => row.categoryId}
          pagination={TABLE_PAGE}
          empty={{ title: '', description: '' }}
        />
      ) : null}
      {data.byMember.length > 0 ? (
        <DataTable
          columns={memberColumns}
          rows={data.byMember}
          getRowId={(row) => row.userId}
          pagination={TABLE_PAGE}
          empty={{ title: '', description: '' }}
        />
      ) : null}
    </PageFlow>
  )
}
