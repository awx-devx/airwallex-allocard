'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { DownloadIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import {
  useExportAudit,
  useExportBudget,
  useExportCards,
  useExportTransactions,
} from '@/client/hooks/useReports'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import { activeOrgRole } from '@/client/lib/projects'
import {
  accessReviewListHref,
  auditHref,
  auditListHref,
  exportBody,
  exportCatalogueHref,
  exportInProgressMessage,
  exportReportsDenialMessage,
  holdsReportExport,
  organizationReportHref,
  parseExportSearchParams,
  projectReportHref,
  viewInAuditLink,
  type ExportSearch,
} from '@/client/lib/reports'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { FilterSelect } from '@/components/patterns/FilterSelect'
import { PageHeader } from '@/components/patterns/PageHeader'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import { SelectItem } from '@/components/ui/select'

const ALL = '__all__'

function mutationErrorMessage(error: unknown): string | undefined {
  if (error === null || error === undefined) {
    return undefined
  }
  return isApiError(error) ? error.message : 'Export failed'
}

export function ReportCatalogue() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseExportSearchParams({
    projectId: params.get('projectId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })
  const me = useMe()
  const permissions = usePermissions()
  const { orgId } = useActiveOrg()
  const projects = useProjects({ page: 1, pageSize: 100 })
  const exportBudget = useExportBudget()
  const exportTransactions = useExportTransactions()
  const exportCards = useExportCards()
  const exportAudit = useExportAudit()
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const canExport =
    me.isPending || permissions.isPending || holdsReportExport(orgRole, permissions.data?.projects)

  function replaceFilter(next: ExportSearch) {
    router.replace(exportCatalogueHref(next))
  }

  const pendingKind = exportBudget.isPending
    ? 'budget'
    : exportTransactions.isPending
      ? 'transactions'
      : exportCards.isPending
        ? 'cards'
        : exportAudit.isPending
          ? 'audit'
          : null
  const exportError =
    mutationErrorMessage(exportBudget.error) ??
    mutationErrorMessage(exportTransactions.error) ??
    mutationErrorMessage(exportCards.error) ??
    mutationErrorMessage(exportAudit.error)
  const auditLink =
    filter.projectId !== undefined && filter.projectId.length >= 1
      ? auditListHref({ projectId: filter.projectId })
      : auditHref()

  const exportButtons = (
    <div className="flex min-w-0 flex-wrap gap-2">
      <Button
        type="button"
        disabled={!canExport || exportBudget.isPending}
        onClick={() => exportBudget.mutate(exportBody(filter))}
      >
        <DownloadIcon className="size-4 shrink-0" aria-hidden />
        Export budget
      </Button>
      <Button
        type="button"
        disabled={!canExport || exportTransactions.isPending}
        onClick={() => exportTransactions.mutate(exportBody(filter))}
      >
        <DownloadIcon className="size-4 shrink-0" aria-hidden />
        Export transactions
      </Button>
      <Button
        type="button"
        disabled={!canExport || exportCards.isPending}
        onClick={() => exportCards.mutate(exportBody(filter))}
      >
        <DownloadIcon className="size-4 shrink-0" aria-hidden />
        Export cards
      </Button>
      <Button
        type="button"
        disabled={!canExport || exportAudit.isPending}
        onClick={() => exportAudit.mutate(exportBody(filter))}
      >
        <DownloadIcon className="size-4 shrink-0" aria-hidden />
        Export audit
      </Button>
    </div>
  )

  return (
    <PageFlow>
      <PageHeader title="Reports" />
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href={organizationReportHref()} className="hover:underline">
                Organization
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Roll-up totals across projects in this organisation.
          </CardContent>
        </Card>
        {filter.projectId !== undefined && filter.projectId.length >= 1 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <Link href={projectReportHref(filter.projectId)} className="hover:underline">
                  Project
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Budget versus actual for the selected project.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Project</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Choose a project above to open its report.
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href={auditLink} className="hover:underline">
                {viewInAuditLink()}
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Audit trail for this organisation.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href={accessReviewListHref({})} className="hover:underline">
                Access reviews
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Open access-review flags.
          </CardContent>
        </Card>
      </div>
      <div className="flex min-w-0 flex-wrap gap-2">
        <FilterSelect
          label="Project"
          value={filter.projectId ?? ALL}
          onValueChange={(value) =>
            replaceFilter({
              ...filter,
              projectId: value === ALL ? undefined : value,
            })
          }
          allLabel="All projects"
        >
          {(projects.data?.items ?? []).map((project) => (
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
              replaceFilter({
                ...filter,
                from: from ?? undefined,
                to: to ?? undefined,
              })
            }
          />
        </div>
      </div>
      {canExport ? (
        exportButtons
      ) : (
        <PermissionGateView allowed={false} denialMessage={exportReportsDenialMessage()}>
          {exportButtons}
        </PermissionGateView>
      )}
      {pendingKind !== null ? (
        <Alert>
          <AlertDescription>{exportInProgressMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {exportError !== undefined ? (
        <Alert variant="destructive">
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      ) : null}
    </PageFlow>
  )
}
