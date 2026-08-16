import { Suspense } from 'react'
import { ApprovalsQueue } from '@/app/(app)/approvals/ApprovalsQueue'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ApprovalsQueue />
    </Suspense>
  )
}
