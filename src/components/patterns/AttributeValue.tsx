import {
  attributeIsStale,
  attributeRelative,
  formatAttributeLiteral,
} from '@/components/patterns/attributeValueMap'
import type { AttributeValueProps } from '@/components/patterns/types'
import { cn } from '@/lib/utils'

export function AttributeValue({
  value,
  observedAt,
  ttlSec,
  unit,
  label,
  now = new Date(),
}: AttributeValueProps) {
  const stale = attributeIsStale(observedAt, ttlSec, now)
  const relative = attributeRelative(observedAt, now)

  return (
    <div className="space-y-1 text-sm">
      {label ? <div className="text-muted-foreground">{label}</div> : null}
      <div className="font-medium">{formatAttributeLiteral(value, unit)}</div>
      {ttlSec === null ? null : (
        <div className={cn('text-xs', stale ? 'text-status-warning' : 'text-muted-foreground')}>
          {stale ? 'Stale · ' : null}
          {relative}
        </div>
      )}
    </div>
  )
}
