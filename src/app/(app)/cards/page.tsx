import { Suspense } from 'react'
import { OrgCardList } from '@/app/(app)/cards/OrgCardList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function OrgCardsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <OrgCardList />
    </Suspense>
  )
}
