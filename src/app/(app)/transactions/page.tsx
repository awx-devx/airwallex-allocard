import { Suspense } from 'react'
import { TransactionList } from '@/app/(app)/transactions/TransactionList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function TransactionsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TransactionList />
    </Suspense>
  )
}
