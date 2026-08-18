import { InboxIcon } from 'lucide-react'
import type { EmptyStateProps } from '@/client/states/EmptyState'
import { Button } from '@/components/ui/button'

export function EmptyState({ title, description, action, illustration }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-10 text-center">
      {illustration ?? <InboxIcon className="size-8 text-muted-foreground" aria-hidden />}
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {action ? (
        <Button type="button" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  )
}
