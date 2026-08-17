'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects, useTransitionProject } from '@/client/hooks/useProjects'
import { useMe, usePermissions } from '@/client/hooks/useSession'
import {
  activeOrgRole,
  canCreateProject,
  createProjectDenialMessage,
  draftWizardHref,
  parseProjectListSearchParams,
  projectListHref,
  projectSortToSorting,
  sortingToProjectSort,
} from '@/client/lib/projects'
import {
  closeProjectLink,
  closureHref,
  finalReportHref,
  finalReportLink,
  isProjectArchived,
  isProjectCloseable,
  isProjectClosing,
  resumeClosureLink,
} from '@/client/lib/reports'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { DataTable } from '@/components/patterns/DataTable'
import { PermissionGate, PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/dates'
import { permissionForTransition } from '@/shared/projectLifecycle'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { Project } from '@/shared/types/project'

const ALL = '__all__'

function CreateProjectControl() {
  const me = useMe()
  const permissions = usePermissions()
  const { orgId } = useActiveOrg()
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const allowed =
    me.isPending || permissions.isPending || canCreateProject({ orgRole, me: permissions.data })

  return (
    <PermissionGateView allowed={allowed} denialMessage={createProjectDenialMessage()}>
      {allowed ? (
        <Button asChild>
          <Link href="/projects/new">Create project</Link>
        </Button>
      ) : (
        <Button type="button" disabled>
          Create project
        </Button>
      )}
    </PermissionGateView>
  )
}

export function ProjectList() {
  const router = useRouter()
  const params = useSearchParams()
  const me = useMe()
  const permissions = usePermissions()
  const { orgId } = useActiveOrg()
  const filter = parseProjectListSearchParams({
    status: params.get('status') ?? undefined,
    ownerId: params.get('ownerId') ?? undefined,
    costCentre: params.get('costCentre') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
    sort: params.get('sort') ?? undefined,
  })
  const query = useProjects(filter)
  const transition = useTransitionProject()
  const [cancelId, setCancelId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const canCreate = canCreateProject({ orgRole, me: permissions.data })
  const costCentres = me.data?.activeOrg?.costCentres ?? []
  const hasListFilter =
    filter.status !== undefined || filter.costCentre !== undefined || filter.ownerId !== undefined

  function replaceFilter(next: typeof filter) {
    router.replace(projectListHref(next))
  }

  async function runTransition(id: string, to: ProjectStatus) {
    setActionError(null)
    try {
      await transition.mutateAsync({ id, input: { to } })
    } catch (error) {
      setActionError(isApiError(error) ? error.message : 'Unable to update project')
    }
  }

  const columns: DataTableColumn<Project>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      cell: (row) => (
        <Link href={`/projects/${row.id}`} className="hover:underline">
          {row.name}
        </Link>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      cell: (row) => row.code,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <StatusBadge kind="project" status={row.status} />,
    },
    {
      id: 'costCentre',
      header: 'Cost centre',
      cell: (row) => row.costCentre ?? '—',
    },
    {
      id: 'updatedAt',
      header: 'Updated',
      sortable: true,
      cell: (row) => formatDate(row.updatedAt),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          {row.status === ProjectStatus.DRAFT ? (
            <>
              <Button asChild size="sm" variant="outline">
                <Link href={draftWizardHref(row.id)}>Resume</Link>
              </Button>
              <PermissionGate
                projectId={row.id}
                permission={permissionForTransition(ProjectStatus.CANCELLED)}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setCancelId(row.id)}
                >
                  Cancel project
                </Button>
              </PermissionGate>
            </>
          ) : null}
          {row.status === ProjectStatus.PENDING_APPROVAL ? (
            <PermissionGate
              projectId={row.id}
              permission={permissionForTransition(ProjectStatus.ACTIVE)}
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void runTransition(row.id, ProjectStatus.ACTIVE)}
              >
                Launch
              </Button>
            </PermissionGate>
          ) : null}
          {row.status === ProjectStatus.CLOSED ? (
            <>
              <PermissionGate
                projectId={row.id}
                permission={permissionForTransition(ProjectStatus.ARCHIVED)}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runTransition(row.id, ProjectStatus.ARCHIVED)}
                >
                  Archive
                </Button>
              </PermissionGate>
              <Button asChild size="sm" variant="outline">
                <Link href={finalReportHref(row.id)}>{finalReportLink()}</Link>
              </Button>
            </>
          ) : null}
          {isProjectCloseable(row.status) ? (
            <PermissionGate projectId={row.id} permission={Permission.PROJECT_CLOSE}>
              <Button asChild size="sm" variant="outline">
                <Link href={closureHref(row.id)}>{closeProjectLink()}</Link>
              </Button>
            </PermissionGate>
          ) : null}
          {isProjectClosing(row.status) ? (
            <Button asChild size="sm" variant="outline">
              <Link href={closureHref(row.id)}>{resumeClosureLink()}</Link>
            </Button>
          ) : null}
          {isProjectArchived(row.status) ? (
            <Button asChild size="sm" variant="outline">
              <Link href={finalReportHref(row.id)}>{finalReportLink()}</Link>
            </Button>
          ) : null}
        </div>
      ),
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
              status: value === ALL ? undefined : (value as ProjectStatus),
              page: 1,
            })
          }
        >
          <SelectTrigger aria-label="Status" size="sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {Object.values(ProjectStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filter.costCentre ?? ALL}
          onValueChange={(value) =>
            replaceFilter({
              ...filter,
              costCentre: value === ALL ? undefined : value,
              page: 1,
            })
          }
        >
          <SelectTrigger aria-label="Cost centre" size="sm">
            <SelectValue placeholder="All cost centres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All</SelectItem>
            {costCentres.map((centre) => (
              <SelectItem key={centre} value={centre}>
                {centre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <CreateProjectControl />
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        getRowId={(row) => row.id}
        sorting={projectSortToSorting(filter.sort)}
        onSortingChange={(next) => replaceFilter({ ...filter, sort: sortingToProjectSort(next) })}
        pagination={{
          mode: 'page',
          page: query.data?.page ?? filter.page,
          pageSize: query.data?.pageSize ?? filter.pageSize,
          total: query.data?.total ?? 0,
          onPageChange: (page) => replaceFilter({ ...filter, page }),
        }}
        loading={query.isPending}
        error={
          query.error
            ? {
                message: isApiError(query.error) ? query.error.message : 'Unable to load projects',
                onRetry: () => void query.refetch(),
              }
            : undefined
        }
        empty={
          hasListFilter
            ? {
                title: 'No projects match',
                description: 'Try a different status or cost centre.',
              }
            : {
                title: 'No projects yet',
                description: 'Create a project to get started.',
                action: canCreate
                  ? { label: 'Create project', onClick: () => router.push('/projects/new') }
                  : undefined,
              }
        }
      />
      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelId(null)
        }}
        title="Cancel this draft?"
        description="The project will move to CANCELLED."
        confirmLabel="Cancel project"
        variant="destructive"
        loading={transition.isPending}
        onConfirm={() => {
          if (cancelId === null) return
          const id = cancelId
          setCancelId(null)
          void runTransition(id, ProjectStatus.CANCELLED)
        }}
      />
    </div>
  )
}
