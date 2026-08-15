import { Suspense } from 'react'
import { ProjectWizard } from '@/app/(app)/projects/new/ProjectWizard'
import { LoadingState } from '@/components/patterns/LoadingState'

export default function NewProjectPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProjectWizard />
    </Suspense>
  )
}
