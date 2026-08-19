'use client'

import { useRouter } from 'next/navigation'
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useBudget } from '@/client/hooks/useBudget'
import { useProject, useTransitionProject } from '@/client/hooks/useProjects'
import {
  hasBudgetFrom,
  isReadyForApprovalInput,
  launchExplainerMessage,
} from '@/client/lib/projects'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
  const router = useRouter()
  const projectQuery = useProject(draftId)
  const budgetQuery = useBudget(draftId)
  const transition = useTransitionProject()
  const [info, setInfo] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const project = projectQuery.data
  const approved = budgetQuery.data?.budget?.approvedAmount ?? null
  const ready =
    project !== undefined &&
    (project.status === ProjectStatus.PENDING_APPROVAL ||
      isReadyForApprovalInput(project, hasBudgetFrom(project, approved)))

  useEffect(() => {
    onValidChange(ready && !transition.isPending)
  }, [onValidChange, ready, transition.isPending])

  useEffect(() => {
    if (project?.status === ProjectStatus.ACTIVE) {
      router.replace(`/projects/${draftId}`)
    }
  }, [draftId, project?.status, router])

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
      router.replace(`/projects/${draftId}`)
      return true
    } catch (error) {
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

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="text-sm">{launchExplainerMessage()}</p>
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
    </div>
  )
})
