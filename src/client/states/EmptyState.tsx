import type { ReactNode } from 'react'

export type EmptyStateProps = {
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  illustration?: ReactNode
}

export { EmptyState } from '@/components/patterns/EmptyState'
