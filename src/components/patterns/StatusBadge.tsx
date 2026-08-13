import { Badge } from '@/components/ui/badge'
import { statusBadgeLabel, statusBadgeVariant } from '@/components/patterns/statusBadgeMap'
import type { StatusBadgeProps } from '@/components/patterns/types'

export function StatusBadge(props: StatusBadgeProps) {
  return <Badge variant={statusBadgeVariant(props)}>{statusBadgeLabel(props)}</Badge>
}
