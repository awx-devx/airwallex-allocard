'use client'

import Link from 'next/link'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget } from '@/client/hooks/useBudget'
import { useProject, useTransitionProject } from '@/client/hooks/useProjects'
import { useProjectActivity } from '@/client/hooks/useReports'
import { hasBudgetFrom, isReadyForApprovalInput, toTimelineItem } from '@/client/lib/projects'
import { Timeline } from '@/components/patterns/Timeline'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'
import { ProjectStatus } from '@/shared/enums/projectStatus'

export type LaunchStepHandle = {
  submit: () => Promise<boolean>
}

export type LaunchStepProps = {
  draftId: string
  onValidChange: (valid: boolean) => void
}

export const LaunchStep = forwardRef<LaunchStepHandle, LaunchStepProps>(function LaunchStep(
  { draftId, onValidChange },
  ref,
) {
  const projectQuery = useProject(draftId)
  const budgetQuery = useBudget(draftId)
  const activity = useProjectActivity(draftId)
  const transition = useTransitionProject()
  const [info, setInfo] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)

  const project = projectQuery.data
  const approved = budgetQuery.data?.budget?.approvedAmount ?? null
  const ready =
    project !== undefined &&
    (project.status === ProjectStatus.PENDING_APPROVAL ||
      isReadyForApprovalInput(project, hasBudgetFrom(project, approved)))

  useEffect(() => {
    onValidChange(ready && !transition.isPending)
  }, [onValidChange, ready, transition.isPending])

  async function submit(): Promise<boolean> {
    if (!project || transition.isPending) return false
    setErrorMessage(null)
    setInfo(null)
    try {
      if (project.status === ProjectStatus.DRAFT) {
        await transition.mutateAsync({
          id: draftId,
          input: { to: ProjectStatus.PENDING_APPROVAL },
        })
      }
      await transition.mutateAsync({
        id: draftId,
        input: { to: ProjectStatus.ACTIVE },
      })
      setAttempted(true)
      await activity.refetch()
      return true
    } catch (error) {
      setAttempted(true)
      void activity.refetch()
      if (isApiError(error) && error.code === ErrorCode.PERMISSION_DENIED) {
        setInfo('Submitted for approval. You need request.approve to launch.')
        return true
      }
      if (isApiError(error) && error.code === ErrorCode.VALIDATION_FAILED) {
        setErrorMessage(error.message)
        return false
      }
      setErrorMessage(isApiError(error) ? error.message : 'Unable to launch project')
      return false
    }
  }

  useImperativeHandle(ref, () => ({ submit }))

  const items = (activity.data?.pages[0]?.items ?? []).map(toTimelineItem)
  const launched = project?.status === ProjectStatus.ACTIVE
  const showTimeline = attempted || launched

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm">
        Launch moves this project to ACTIVE and emits project.launched, which is what causes cards
        to appear.
      </p>
      {info ? (
        <Alert variant="info">
          <AlertDescription>{info}</AlertDescription>
        </Alert>
      ) : null}
      {errorMessage ? (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {showTimeline ? <Timeline items={items} loading={activity.isPending} /> : null}
      <div className="flex flex-wrap gap-2">
        {launched ? (
          <Button asChild>
            <Link href={`/projects/${draftId}`}>Open project</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
})
