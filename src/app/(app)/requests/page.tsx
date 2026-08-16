import { Suspense } from 'react'
import { RequestList } from '@/app/(app)/requests/RequestList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function RequestsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequestList />
    </Suspense>
  )
}
