import { Suspense } from 'react'
import { RuleBuilder } from '@/app/(app)/settings/rules/[id]/RuleBuilder'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function RuleBuilderPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RuleBuilder />
    </Suspense>
  )
}
