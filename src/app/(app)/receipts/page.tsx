import { Suspense } from 'react'
import { ReceiptsQueue } from '@/app/(app)/receipts/ReceiptsQueue'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReceiptsQueue />
    </Suspense>
  )
}
