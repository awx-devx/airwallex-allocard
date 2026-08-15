'use client'

import { useUnsavedChangesGuard } from '@/client/lib/forms/useUnsavedChangesGuard'
import type { StepWizardProps } from '@/components/patterns/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function StepWizard({
  steps,
  activeStepId,
  isStepValid,
  isDirty = false,
  onNext,
  onBack,
  onCancel,
  nextLabel,
  children,
}: StepWizardProps) {
  useUnsavedChangesGuard(isDirty)
  const index = steps.findIndex((step) => step.id === activeStepId)
  const isFirst = index <= 0
  const nextDisabled = !isStepValid(activeStepId)

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={cn(
              'rounded-md px-2 py-1',
              step.id === activeStepId
                ? 'bg-primary text-primary-foreground'
                : i < index
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground',
            )}
          >
            {step.label}
            {step.optional ? ' (optional)' : ''}
          </li>
        ))}
      </ol>
      <div>{children}</div>
      <div className="flex gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={isFirst} onClick={onBack}>
          Back
        </Button>
        <Button type="button" disabled={nextDisabled} onClick={onNext}>
          {nextLabel ?? 'Continue'}
        </Button>
      </div>
    </div>
  )
}
