import { Suspense } from 'react'
import { AuditList } from '@/app/(app)/audit/AuditList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function AuditPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuditList />
    </Suspense>
  )
}
