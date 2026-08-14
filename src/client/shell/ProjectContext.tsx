import { StatusBadge } from '@/components/patterns/StatusBadge'
import { ProjectStatus } from '@/shared/enums/projectStatus'

export type ProjectContextProps = {
  project: { id: string; name: string; code: string; status: string } | null
}

function isProjectStatus(status: string): status is ProjectStatus {
  return (Object.values(ProjectStatus) as string[]).includes(status)
}

export function ProjectContext({ project }: ProjectContextProps) {
  if (!project) {
    return <div aria-hidden className="min-h-6" />
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <strong className="text-sm font-medium">{project.name}</strong>
      <span className="text-sm text-muted-foreground">{project.code}</span>
      {isProjectStatus(project.status) ? (
        <StatusBadge kind="project" status={project.status} />
      ) : (
        <span className="text-sm text-muted-foreground">{project.status}</span>
      )}
    </div>
  )
}
