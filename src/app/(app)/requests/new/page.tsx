import { Suspense } from 'react'
import { RequestForm } from '@/app/(app)/requests/new/RequestForm'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function NewRequestPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <RequestForm />
    </Suspense>
  )
}
