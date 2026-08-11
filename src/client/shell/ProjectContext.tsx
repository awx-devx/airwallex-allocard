export type ProjectContextProps = {
  project: { id: string; name: string; code: string; status: string } | null
}

export function ProjectContext({ project }: ProjectContextProps) {
  if (!project) {
    return <div aria-hidden style={{ minHeight: 24 }} />
  }
  return (
    <div>
      <strong>{project.name}</strong>
      <span style={{ marginLeft: 8, color: '#666' }}>
        {project.code} · {project.status}
      </span>
    </div>
  )
}
