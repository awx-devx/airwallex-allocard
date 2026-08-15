'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProject } from '@/client/hooks/useProjects'
import { useMe } from '@/client/hooks/useSession'
import {
  nextWizardStepId,
  parseDraftId,
  prevWizardStepId,
  WIZARD_STEPS,
} from '@/client/lib/projects'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { StepWizard } from '@/components/patterns/StepWizard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DetailsStep, type DetailsStepHandle } from '@/app/(app)/projects/new/steps/DetailsStep'
import { BudgetStep, type BudgetStepHandle } from '@/app/(app)/projects/new/steps/BudgetStep'
import { ErrorCode } from '@/shared/enums/errors'
import { ProjectStatus } from '@/shared/enums/projectStatus'

const STEPS = WIZARD_STEPS.map(({ id, label, optional }) => ({ id, label, optional }))

export function ProjectWizard() {
  const router = useRouter()
  const params = useSearchParams()
  const me = useMe()
  const detailsRef = useRef<DetailsStepHandle>(null)
  const budgetRef = useRef<BudgetStepHandle>(null)
  const [activeStepId, setActiveStepId] = useState('details')
  const [localDraftId, setLocalDraftId] = useState<string | null>(null)
  const [detailsValid, setDetailsValid] = useState(false)
  const [budgetValid, setBudgetValid] = useState(false)
  const [detailsDirty, setDetailsDirty] = useState(false)
  const [budgetDirty, setBudgetDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const urlDraftId = parseDraftId({ draftId: params.get('draftId') ?? undefined })
  const draftId = urlDraftId ?? localDraftId
  const projectQuery = useProject(draftId ?? '')

  const project = projectQuery.data
  const launched = project !== undefined && project.status !== ProjectStatus.DRAFT

  function isStepValid(id: string): boolean {
    const step = WIZARD_STEPS.find((item) => item.id === id)
    if (step?.optional) return true
    if (id === 'details') return detailsValid && !saving && !launched
    if (id === 'budget') return budgetValid && !saving && !launched && draftId !== null
    return false
  }

  async function handleNext() {
    if (activeStepId === 'details') {
      setSaving(true)
      try {
        const id = await detailsRef.current?.submit()
        if (id) {
          setLocalDraftId(id)
          setActiveStepId('budget')
        }
      } finally {
        setSaving(false)
      }
      return
    }
    if (activeStepId === 'budget') {
      if (!draftId) {
        setActiveStepId('details')
        return
      }
      setSaving(true)
      try {
        const ok = await budgetRef.current?.submit()
        if (ok) {
          const next = nextWizardStepId('budget')
          if (next) setActiveStepId(next)
        }
      } finally {
        setSaving(false)
      }
      return
    }
    const next = nextWizardStepId(activeStepId)
    if (next) setActiveStepId(next)
  }

  function handleBack() {
    const prev = prevWizardStepId(activeStepId)
    if (prev) setActiveStepId(prev)
  }

  function leave() {
    router.push('/projects')
  }

  function handleCancel() {
    if (detailsDirty || budgetDirty) {
      setDiscardOpen(true)
      return
    }
    leave()
  }

  if (me.isPending) {
    return <LoadingState label="Loading wizard" />
  }
  if (!me.data?.user) {
    return <ErrorState message="Unable to load account" />
  }

  if (draftId) {
    if (projectQuery.isPending) {
      return <LoadingState label="Loading draft" />
    }
    if (projectQuery.error) {
      const notFound =
        isApiError(projectQuery.error) && projectQuery.error.code === ErrorCode.NOT_FOUND
      return (
        <ErrorState
          message={notFound ? 'This project is not available.' : 'Unable to load project'}
          code={isApiError(projectQuery.error) ? projectQuery.error.code : undefined}
        />
      )
    }
  }

  const stepLabel = WIZARD_STEPS.find((step) => step.id === activeStepId)?.label ?? activeStepId

  return (
    <div className="min-w-0">
      {launched ? (
        <Alert variant="info" className="mb-4">
          <AlertDescription>
            This project is no longer a draft.{' '}
            <Link href={`/projects/${project.id}`} className="underline">
              Open project
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <StepWizard
        steps={STEPS}
        activeStepId={activeStepId}
        isStepValid={isStepValid}
        isDirty={detailsDirty || budgetDirty}
        onNext={() => void handleNext()}
        onBack={handleBack}
        onCancel={handleCancel}
      >
        {activeStepId === 'details' ? (
          <DetailsStep
            ref={detailsRef}
            draftId={draftId}
            project={project}
            user={me.data.user}
            launched={launched}
            onValidChange={setDetailsValid}
            onDirtyChange={setDetailsDirty}
          />
        ) : activeStepId === 'budget' && draftId ? (
          <BudgetStep
            ref={budgetRef}
            draftId={draftId}
            project={project}
            onValidChange={setBudgetValid}
            onDirtyChange={setBudgetDirty}
          />
        ) : activeStepId === 'budget' && !draftId ? (
          <p>Budget needs a draft — go back to Details.</p>
        ) : (
          <p>{stepLabel} — not built yet</p>
        )}
      </StepWizard>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unsaved changes?"
        description="Unsaved edits on this step will be lost."
        confirmLabel="Discard"
        variant="destructive"
        onConfirm={() => {
          setDiscardOpen(false)
          leave()
        }}
      />
    </div>
  )
}
