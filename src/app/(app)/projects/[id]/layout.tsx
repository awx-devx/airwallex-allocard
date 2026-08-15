import { ProjectWorkspace } from '@/app/(app)/projects/[id]/ProjectWorkspace'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <ProjectWorkspace>{children}</ProjectWorkspace>
}
