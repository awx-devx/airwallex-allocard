import type { ReactNode } from 'react'
import { formatRelative } from '@/lib/dates'

export type PartialStateProps = {
  children: ReactNode
  observedAt: string
  staleAfterMs?: number
  asOf?: string
}

export function PartialState({
  children,
  observedAt,
  staleAfterMs = 15 * 60_000,
  asOf,
}: PartialStateProps) {
  const observedMs = Date.parse(observedAt)
  const asOfMs = asOf === undefined ? observedMs : Date.parse(asOf)
  const age =
    Number.isFinite(observedMs) && Number.isFinite(asOfMs)
      ? asOfMs - observedMs
      : Number.POSITIVE_INFINITY
  const stale = asOf !== undefined && age > staleAfterMs
  const relative = formatRelative(observedAt, asOf ? new Date(asOf) : new Date())

  return (
    <div>
      {stale ? <div className="mb-1 text-xs text-status-warning">Updated {relative}</div> : null}
      {children}
    </div>
  )
}
