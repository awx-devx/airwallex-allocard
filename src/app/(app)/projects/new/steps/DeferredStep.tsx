'use client'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function DeferredStep({ title, phase }: { title: string; phase: 'A3' | 'A6' | 'A7' }) {
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="info">
        <AlertTitle>
          {title} land in {phase}.
        </AlertTitle>
        <AlertDescription>Nothing is saved on this step.</AlertDescription>
      </Alert>
    </div>
  )
}
