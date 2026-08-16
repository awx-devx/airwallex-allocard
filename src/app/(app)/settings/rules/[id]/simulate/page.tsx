import { Suspense } from 'react'
import { SimulateRule } from '@/app/(app)/settings/rules/[id]/simulate/SimulateRule'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function SimulateRulePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SimulateRule />
    </Suspense>
  )
}
