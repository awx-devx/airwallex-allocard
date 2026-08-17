import { Suspense } from 'react'
import { ReportCatalogue } from '@/app/(app)/reports/ReportCatalogue'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function ReportsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ReportCatalogue />
    </Suspense>
  )
}
