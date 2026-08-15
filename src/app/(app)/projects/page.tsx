import { Suspense } from 'react'
import { ProjectList } from '@/app/(app)/projects/ProjectList'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function ProjectsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectList />
    </Suspense>
  )
}
