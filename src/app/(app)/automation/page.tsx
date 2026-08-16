import { Suspense } from 'react'
import { AutomationHistory } from '@/app/(app)/automation/AutomationHistory'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function AutomationPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AutomationHistory />
    </Suspense>
  )
}
