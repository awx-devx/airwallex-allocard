import { Suspense } from 'react'
import { DeclinedList } from '@/app/(app)/transactions/declined/DeclinedList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function DeclinedTransactionsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DeclinedList />
    </Suspense>
  )
}
