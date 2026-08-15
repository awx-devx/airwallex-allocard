'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProject, useTransitionProject } from '@/client/hooks/useProjects'
import { draftWizardHref, projectFromListCache, WORKSPACE_TAB_HREFS } from '@/client/lib/projects'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGate } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { permissionForTransition } from '@/shared/projectLifecycle'
import { ErrorCode } from '@/shared/enums/errors'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { Project } from '@/shared/types/project'

export function ProjectWorkspace({ children }: { children: ReactNode }) {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const cached = projectFromListCache(queryClient.getQueriesData({ queryKey: ['projects'] }), id)
  const detail = useProject(id)
  const transition = useTransitionProject()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const header: Project | undefined = detail.data ?? cached
  const notFound = isApiError(detail.error) && detail.error.code === ErrorCode.NOT_FOUND

  async function runTransition(to: ProjectStatus) {
    setActionError(null)
    try {
      await transition.mutateAsync({ id, input: { to } })
    } catch (error) {
      setActionError(isApiError(error) ? error.message : 'Unable to update project')
    }
  }

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (notFound) {
    return <ErrorState message="This project is not available." />
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {header ? (
          <>
            <strong className="text-sm font-medium">{header.name}</strong>
            <span className="text-sm text-muted-foreground">{header.code}</span>
            <StatusBadge kind="project" status={header.status} />
          </>
        ) : (
          <LoadingState label="Loading project" rows={1} />
        )}
        {header ? (
          <div className="flex flex-wrap gap-2">
            {header.status === ProjectStatus.DRAFT ? (
              <>
                <Button asChild size="sm" variant="outline">
                  <Link href={draftWizardHref(id)}>Resume</Link>
                </Button>
                <PermissionGate
                  projectId={id}
                  permission={permissionForTransition(ProjectStatus.CANCELLED)}
                >
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setCancelOpen(true)}
                  >
                    Cancel project
                  </Button>
                </PermissionGate>
              </>
            ) : null}
            {header.status === ProjectStatus.PENDING_APPROVAL ? (
              <PermissionGate
                projectId={id}
                permission={permissionForTransition(ProjectStatus.ACTIVE)}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runTransition(ProjectStatus.ACTIVE)}
                >
                  Launch
                </Button>
              </PermissionGate>
            ) : null}
            {header.status === ProjectStatus.CLOSED ? (
              <PermissionGate
                projectId={id}
                permission={permissionForTransition(ProjectStatus.ARCHIVED)}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void runTransition(ProjectStatus.ARCHIVED)}
                >
                  Archive
                </Button>
              </PermissionGate>
            ) : null}
          </div>
        ) : null}
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Project">
        {WORKSPACE_TAB_HREFS.map((item) => {
          const href = item.href(id)
          const overview = item.tab === 'Overview'
          const active = overview
            ? pathname === href
            : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={item.tab}
              href={href}
              className={cn(buttonVariants({ variant: 'ghost' }), active && 'bg-accent')}
            >
              {item.tab}
            </Link>
          )
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this draft?"
        description="The project will move to CANCELLED."
        confirmLabel="Cancel project"
        variant="destructive"
        loading={transition.isPending}
        onConfirm={() => {
          setCancelOpen(false)
          void runTransition(ProjectStatus.CANCELLED)
        }}
      />
    </div>
  )
}
