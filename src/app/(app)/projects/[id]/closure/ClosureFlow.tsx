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
  CLOSURE_STEPS,
  SETTLE_POLL_MS,
  archiveConfirm,
  blockerHref,
  canClickComplete,
  canClickStart,
  closeCardsAndArchiveLabel,
  closeCardsConfirm,
  closeProjectDenialMessage,
  closureActiveStep,
  closureBlockedHeading,
  closureResumeMessage,
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
  stepStatusOf,
  transactionListHref,
} from '@/client/lib/reports'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGate } from '@/components/patterns/PermissionGate'
import { StepWizard } from '@/components/patterns/StepWizard'
import { PageFlow } from '@/components/patterns/PageBody'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'

export function ClosureFlow() {
  const router = useRouter()
  const id = parseOptionalIdParam(useParams().id) ?? ''
  const project = useProject(id)
  const status = project.data?.status ?? ''
  const preflight = useClosurePreflight(
    isProjectCloseable(status) || isProjectClosing(status) ? id : '',
  )
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

  if (isProjectArchived(status)) {
    return (
      <PageFlow>
        <Link href={finalReportHref(id)} className={buttonVariants({ variant: 'ghost' })}>
          {finalReportLink()}
        </Link>
      </PageFlow>
    )
  }

  if (status === ProjectStatus.CLOSED) {
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
          <StepWizard
            steps={[...CLOSURE_STEPS]}
            activeStepId="PREFLIGHT"
            nextLabel={startClosureLabel()}
            isStepValid={() => canClickStart({ projectStatus: status, canStart, archived: false })}
            onNext={() => {
              setActionError(null)
              void start.mutateAsync({ id }).catch((error: unknown) => {
                setActionError(isApiError(error) ? error.message : 'Unable to start closure')
              })
            }}
            onBack={() => {}}
          >
            <div className="flex min-w-0 flex-col gap-4">
              {canStart ? (
                <p className="min-w-0 break-words text-sm">
                  Start will freeze remaining non-CLOSED cards.
                </p>
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
            </div>
          </StepWizard>
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
        <Alert>
          <AlertDescription>{closureResumeMessage()}</AlertDescription>
        </Alert>
        <PermissionGate
          projectId={id}
          permission={Permission.PROJECT_CLOSE}
          fallback={<p className="text-sm">{closeProjectDenialMessage()}</p>}
        >
          <StepWizard
            steps={[...CLOSURE_STEPS]}
            activeStepId={closureActiveStep('CLOSING', currentStep)}
            nextLabel={closeCardsAndArchiveLabel()}
            isStepValid={() =>
              canClickComplete({ projectStatus: 'CLOSING', steps, archived: false })
            }
            onNext={() => setConfirm('close')}
            onBack={() => {}}
          >
            <div className="flex min-w-0 flex-col gap-4">
              {CLOSURE_STEPS.map((step) => {
                const stepStatus = stepStatusOf(steps, step.id)
                return (
                  <div key={step.id} className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-sm">{step.label}</span>
                    {stepStatus !== undefined ? (
                      <Badge variant="outline">{stepStatus}</Badge>
                    ) : null}
                  </div>
                )
              })}
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
              ) : null}
            </div>
          </StepWizard>
        </PermissionGate>
        {confirms}
      </PageFlow>
    )
  }

  return <div className="min-w-0" />
}
