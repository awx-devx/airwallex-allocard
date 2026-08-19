'use client'

import { CheckIcon } from 'lucide-react'
import { useUnsavedChangesGuard } from '@/client/lib/forms/useUnsavedChangesGuard'
import { FormPanel } from '@/components/patterns/FormPanel'
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
    <div className="flex min-w-0 flex-col gap-4">
      <ol aria-label="Progress" className="flex flex-wrap items-center gap-y-3">
        {steps.map((step, i) => {
          const complete = i < index
          const current = i === index
          return (
            <li
              key={step.id}
              aria-current={current ? 'step' : undefined}
              className="flex items-center"
            >
              {i > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    'mx-1.5 h-px w-5 shrink-0',
                    i <= index ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-medium',
                    current && 'bg-primary text-primary-foreground',
                    complete && 'bg-primary/15 text-primary',
                    !current && !complete && 'border border-input bg-card text-muted-foreground',
                  )}
                >
                  {complete ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    'text-sm',
                    current && 'font-medium text-foreground',
                    complete && 'text-foreground',
                    !current && !complete && 'text-muted-foreground',
                  )}
                >
                  {step.label}
                  {step.optional ? ' (optional)' : ''}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
      <FormPanel
        className="[&_button:disabled]:bg-muted [&_button:disabled]:text-muted-foreground [&_button:disabled]:opacity-100 [&_button:disabled]:shadow-none"
        footer={
          <>
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
          </>
        }
      >
        {children}
      </FormPanel>
    </div>
  )
}
