'use client'

import Link from 'next/link'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useOrganizationReport } from '@/client/hooks/useReports'
import {
  auditHref,
  finalReportHref,
  finalReportLink,
  isProjectArchived,
  mixedCurrencyMessage,
  noOrgProjectsEmpty,
  orgTotalsExcludeSomeProjects,
  projectReportHref,
  reportsHref,
  viewInAuditLink,
} from '@/client/lib/reports'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PageHeader } from '@/components/patterns/PageHeader'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import type { DataTableColumn } from '@/components/patterns/types'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { OrganizationReport as OrganizationReportData } from '@/shared/types/report'

type ProjectRow = OrganizationReportData['projects'][number]

const TABLE_PAGE = {
  mode: 'cursor' as const,
  nextCursor: null,
  onLoadMore: () => {},
}

export function OrganizationReport() {
  const query = useOrganizationReport()
  const listed = useProjects({ page: 1, pageSize: 100 })

  if (query.isPending) {
    return <LoadingState />
  }

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load report'}
      />
    )
  }

  if (!query.data) {
    return <LoadingState />
  }

  const data = query.data
  const empty = noOrgProjectsEmpty()
  const statusById = new Map((listed.data?.items ?? []).map((row) => [row.id, row.status] as const))

  if (data.projects.length === 0) {
    return (
      <PageFlow>
        <div className="flex min-w-0 flex-wrap gap-2">
          <Link href={reportsHref()} className={buttonVariants({ variant: 'ghost' })}>
            Back
          </Link>
          <Link href={auditHref()} className={buttonVariants({ variant: 'ghost' })}>
            {viewInAuditLink()}
          </Link>
        </div>
        <EmptyState title={empty.title} description={empty.description} />
      </PageFlow>
    )
  }

  const columns: DataTableColumn<ProjectRow>[] = [
    {
      id: 'name',
      header: 'Project',
      cell: (row) => {
        const status = statusById.get(row.projectId)
        const showFinal =
          status !== undefined && (isProjectArchived(status) || status === ProjectStatus.CLOSED)
        return (
          <span className="flex min-w-0 flex-col gap-1">
            <Link
              href={projectReportHref(row.projectId)}
              className="min-w-0 break-words hover:underline"
            >
              {row.name}
            </Link>
            {showFinal ? (
              <Link
                href={finalReportHref(row.projectId)}
                className="text-sm underline underline-offset-4"
              >
                {finalReportLink()}
              </Link>
            ) : null}
          </span>
        )
      },
    },
    {
      id: 'approved',
      header: 'Approved',
      cell: (row) => (
        <MoneyDisplay
          money={{ amount: row.approved, currency: data.currency }}
          colorBySign={false}
        />
      ),
    },
    {
      id: 'committed',
      header: 'Committed',
      cell: (row) => (
        <MoneyDisplay
          money={{ amount: row.committed, currency: data.currency }}
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
    {
      id: 'remaining',
      header: 'Remaining',
      cell: (row) => (
        <MoneyDisplay money={{ amount: row.remaining, currency: data.currency }} colorBySign />
      ),
    },
    {
      id: 'utilisation',
      header: 'Utilisation',
      cell: (row) => `${row.utilisationPct}%`,
    },
  ]

  return (
    <PageFlow>
      <div className="flex min-w-0 flex-wrap gap-2">
        <Link href={reportsHref()} className={buttonVariants({ variant: 'ghost' })}>
          Back
        </Link>
        <Link href={auditHref()} className={buttonVariants({ variant: 'ghost' })}>
          {viewInAuditLink()}
        </Link>
      </div>
      <PageHeader title="Organization report" />
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay
              money={{ amount: data.totals.approved, currency: data.currency }}
              colorBySign={false}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Committed</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay
              money={{ amount: data.totals.committed, currency: data.currency }}
              colorBySign={false}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay
              money={{ amount: data.totals.actual, currency: data.currency }}
              colorBySign={false}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Remaining</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyDisplay money={{ amount: data.totals.remaining, currency: data.currency }} />
          </CardContent>
        </Card>
      </div>
      {orgTotalsExcludeSomeProjects(data.projects, data.totals) ? (
        <Alert>
          <AlertDescription>{mixedCurrencyMessage()}</AlertDescription>
        </Alert>
      ) : null}
      <DataTable
        columns={columns}
        rows={data.projects}
        getRowId={(row) => row.projectId}
        pagination={TABLE_PAGE}
        empty={empty}
      />
    </PageFlow>
  )
}
