import { formatRelative, isStale } from '@/lib/dates'
import type { AttributeValueProps } from '@/components/patterns/types'

export function formatAttributeLiteral(
  value: number | string | boolean | null,
  unit?: string | null,
): string {
  if (value === null) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  const literal = String(value)
  return unit ? `${literal} ${unit}` : literal
}

export function attributeIsStale(observedAt: string, ttlSec: number | null, now: Date): boolean {
  return isStale(observedAt, ttlSec, now)
}

export function attributeRelative(observedAt: string, now: Date): string {
  return formatRelative(observedAt, now)
}
