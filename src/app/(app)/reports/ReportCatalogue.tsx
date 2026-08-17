'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
        Export budget
      </Button>
      <Button
        type="button"
        disabled={!canExport || exportTransactions.isPending}
        onClick={() => exportTransactions.mutate(exportBody(filter))}
      >
        Export transactions
      </Button>
      <Button
        type="button"
        disabled={!canExport || exportCards.isPending}
        onClick={() => exportCards.mutate(exportBody(filter))}
      >
        Export cards
      </Button>
      <Button
        type="button"
        disabled={!canExport || exportAudit.isPending}
        onClick={() => exportAudit.mutate(exportBody(filter))}
      >
        Export audit
      </Button>
    </div>
  )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 flex-wrap gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select
            value={filter.projectId ?? ALL}
            onValueChange={(value) =>
              replaceFilter({
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
              {(projects.data?.items ?? []).map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Dates</Label>
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
      <div className="flex min-w-0 flex-wrap gap-2">
        <Link href={organizationReportHref()} className={buttonVariants({ variant: 'ghost' })}>
          Organization
        </Link>
        {filter.projectId !== undefined && filter.projectId.length >= 1 ? (
          <Link
            href={projectReportHref(filter.projectId)}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Project
          </Link>
        ) : null}
        <Link href={auditLink} className={buttonVariants({ variant: 'ghost' })}>
          {viewInAuditLink()}
        </Link>
        <Link href={accessReviewListHref({})} className={buttonVariants({ variant: 'ghost' })}>
          Access reviews
        </Link>
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
    </div>
  )
}
