'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProject } from '@/client/hooks/useProjects'
import {
  useClosurePreflight,
  useClosureStatus,
  useCompleteClosure,
  useStartClosure,
} from '@/client/hooks/useReports'
import {
  SETTLE_POLL_MS,
  archiveConfirm,
  blockerHref,
  canClickComplete,
  canClickStart,
  closeCardsAndArchiveLabel,
  closeCardsConfirm,
  closeProjectDenialMessage,
  closureBlockedHeading,
  closureFinishHint,
  closureStartHint,
  completeClosureInput,
  finalReportHref,
  finalReportLink,
  formatBlockerSummary,
  isProjectArchived,
  isProjectCloseable,
  isProjectClosing,
  parseOptionalIdParam,
  projectNotFoundMessage,
  settleWaitingMessage,
  shouldPollSettle,
  startClosureLabel,
  transactionListHref,
} from '@/client/lib/reports'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FormPanel } from '@/components/patterns/FormPanel'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGate } from '@/components/patterns/PermissionGate'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'

export function ClosureFlow() {
  const router = useRouter()
  const id = parseOptionalIdParam(useParams().id) ?? ''
  const project = useProject(id)
  const status = project.data?.status ?? ''
  const preflight = useClosurePreflight(isProjectCloseable(status) ? id : '')
  const closureStatus = useClosureStatus(isProjectClosing(status) ? id : '')
  const start = useStartClosure()
  const complete = useCompleteClosure()
  const [confirm, setConfirm] = useState<'close' | 'archive' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const currentStep = closureStatus.data?.currentStep
  const steps = closureStatus.data?.steps ?? []
  const settleStep = steps.find((row) => row.step === 'SETTLE')
  const pollSettle = isProjectClosing(status) && shouldPollSettle(currentStep ?? '', steps)
  const refetchClosureStatus = closureStatus.refetch

  useEffect(() => {
    if (!pollSettle) {
      return
    }
    const timer = window.setInterval(() => {
      void refetchClosureStatus()
    }, SETTLE_POLL_MS)
    return () => window.clearInterval(timer)
  }, [pollSettle, refetchClosureStatus])

  if (!id) {
    return <ErrorState message={projectNotFoundMessage()} />
  }

  if (project.isPending) {
    return <LoadingState />
  }

  if (project.error) {
    if (isApiError(project.error) && project.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message={projectNotFoundMessage()} />
    }
    return (
      <ErrorState
        message={isApiError(project.error) ? project.error.message : 'Unable to load project'}
      />
    )
  }

  if (isProjectArchived(status) || status === ProjectStatus.CLOSED) {
    return (
      <PageFlow>
        <Alert>
          <AlertDescription>
            <Link href={finalReportHref(id)} className="underline-offset-4 hover:underline">
              {finalReportLink()}
            </Link>
          </AlertDescription>
        </Alert>
      </PageFlow>
    )
  }

  const closeCopy = closeCardsConfirm()
  const archiveCopy = archiveConfirm()
  const errorAlert = actionError ? (
    <Alert variant="destructive">
      <AlertDescription>{actionError}</AlertDescription>
    </Alert>
  ) : null

  const confirms = (
    <>
      <ConfirmDialog
        open={confirm === 'close'}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={closeCopy.title}
        description={closeCopy.description ?? closeCopy.prompt}
        confirmLabel={closeCopy.confirmLabel}
        variant="destructive"
        typeToConfirm={{ phrase: closeCopy.phrase, prompt: closeCopy.prompt }}
        onConfirm={() => setConfirm('archive')}
      />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={archiveCopy.title}
        confirmLabel={archiveCopy.confirmLabel}
        variant="destructive"
        typeToConfirm={{ phrase: archiveCopy.phrase, prompt: archiveCopy.prompt }}
        loading={complete.isPending}
        onConfirm={() => {
          setActionError(null)
          complete.mutate(
            { id, input: completeClosureInput() },
            {
              onSuccess: () => {
                setConfirm(null)
                router.push(finalReportHref(id))
              },
              onError: (error) => {
                setConfirm(null)
                setActionError(isApiError(error) ? error.message : 'Unable to complete closure')
              },
            },
          )
        }}
      />
    </>
  )

  if (isProjectCloseable(status)) {
    if (preflight.isPending) {
      return <LoadingState />
    }
    if (preflight.error) {
      return (
        <ErrorState
          message={
            isApiError(preflight.error) ? preflight.error.message : 'Unable to load preflight'
          }
        />
      )
    }
    const canStart = preflight.data?.canStart === true
    const blockers = preflight.data?.blockers ?? []
    return (
      <PageFlow>
        {errorAlert}
        <PermissionGate
          projectId={id}
          permission={Permission.PROJECT_CLOSE}
          fallback={<p className="text-sm">{closeProjectDenialMessage()}</p>}
        >
          <FormPanel
            footer={
              <Button
                type="button"
                disabled={
                  !canClickStart({ projectStatus: status, canStart, archived: false }) ||
                  start.isPending
                }
                onClick={() => {
                  setActionError(null)
                  void start.mutateAsync({ id }).catch((error: unknown) => {
                    setActionError(isApiError(error) ? error.message : 'Unable to start closure')
                  })
                }}
              >
                {startClosureLabel()}
              </Button>
            }
          >
            {canStart ? (
              <p className="min-w-0 break-words text-sm">{closureStartHint()}</p>
            ) : (
              <>
                <h2 className="text-sm font-medium">{closureBlockedHeading()}</h2>
                <ul className="flex min-w-0 flex-col gap-2">
                  {blockers.map((item) => (
                    <li key={`${item.subjectType}-${item.subjectId}`}>
                      <Link
                        href={blockerHref(item, id)}
                        className="min-w-0 break-words underline underline-offset-4"
                      >
                        {formatBlockerSummary(item.summary)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </FormPanel>
        </PermissionGate>
      </PageFlow>
    )
  }

  if (isProjectClosing(status)) {
    if (closureStatus.isPending) {
      return <LoadingState />
    }
    if (closureStatus.error) {
      return (
        <ErrorState
          message={
            isApiError(closureStatus.error) ? closureStatus.error.message : 'Unable to load closure'
          }
        />
      )
    }
    const settleWaiting =
      currentStep === 'SETTLE' &&
      (settleStep?.status === 'BLOCKED' || settleStep?.status === 'IN_PROGRESS')
    return (
      <PageFlow>
        {errorAlert}
        <PermissionGate
          projectId={id}
          permission={Permission.PROJECT_CLOSE}
          fallback={<p className="text-sm">{closeProjectDenialMessage()}</p>}
        >
          <FormPanel
            footer={
              <Button
                type="button"
                disabled={
                  !canClickComplete({ projectStatus: 'CLOSING', steps, archived: false }) ||
                  complete.isPending
                }
                onClick={() => setConfirm('close')}
              >
                {closeCardsAndArchiveLabel()}
              </Button>
            }
          >
            {settleWaiting ? (
              <Alert>
                <AlertDescription className="flex min-w-0 flex-col gap-2">
                  <span>{settleWaitingMessage()}</span>
                  {settleStep?.detail ? (
                    <span className="min-w-0 break-words">{settleStep.detail}</span>
                  ) : null}
                  <Link
                    href={transactionListHref({ projectId: id, status: 'AUTHORIZED' })}
                    className={buttonVariants({ variant: 'ghost' })}
                  >
                    Transactions
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void closureStatus.refetch()}
                  >
                    Refresh
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <p className="min-w-0 break-words text-sm">{closureFinishHint()}</p>
            )}
          </FormPanel>
        </PermissionGate>
        {confirms}
      </PageFlow>
    )
  }

  return <div className="min-w-0" />
}
