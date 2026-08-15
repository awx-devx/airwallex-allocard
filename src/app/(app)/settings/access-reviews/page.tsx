import { Suspense } from 'react'
import { AccessReviewList } from '@/app/(app)/settings/access-reviews/AccessReviewList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function AccessReviewsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AccessReviewList />
    </Suspense>
  )
}
