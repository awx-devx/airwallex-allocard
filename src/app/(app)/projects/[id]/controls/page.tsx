import { Suspense } from 'react'
import { ProjectControls } from '@/app/(app)/projects/[id]/controls/ProjectControls'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function ProjectControlsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectControls />
    </Suspense>
  )
}
