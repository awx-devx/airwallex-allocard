import { Suspense } from 'react'
import { ProjectCards } from '@/app/(app)/projects/[id]/cards/ProjectCards'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function ProjectCardsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectCards />
    </Suspense>
  )
}
