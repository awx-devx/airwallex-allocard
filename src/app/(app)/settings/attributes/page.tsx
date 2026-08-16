import { Suspense } from 'react'
import { AttributeRegistry } from '@/app/(app)/settings/attributes/AttributeRegistry'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function AttributesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AttributeRegistry />
    </Suspense>
  )
}
