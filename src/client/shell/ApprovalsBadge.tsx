import { Badge } from '@/components/ui/badge'

export function ApprovalsBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Badge variant="default" aria-label={`${count} pending approvals`}>
      {count}
    </Badge>
  )
}
