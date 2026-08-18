import { ClipboardCheckIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ApprovalsBadge({ count }: { count: number }) {
  if (count <= 0) return null
  return (
    <Badge variant="default" aria-label={`${count} pending approvals`} className="gap-1">
      <ClipboardCheckIcon className="size-4 shrink-0" aria-hidden />
      {count}
    </Badge>
  )
}
