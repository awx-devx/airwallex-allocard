import type { ReactNode } from 'react'

export type EmptyStateProps = {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  illustration?: ReactNode
}

export function EmptyState({ title, description, action, illustration }: EmptyStateProps) {
  return (
    <div style={{ textAlign: 'center', padding: 32 }}>
      {illustration}
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <button type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  )
}
