import type { ReactNode } from 'react'

export type PartialStateProps = {
  children: ReactNode
  observedAt: string
  staleAfterMs?: number
  /** Comparison instant (ISO). Omit to skip staleness (treat as fresh). */
  asOf?: string
}

function formatRelative(msAgo: number): string {
  const minutes = Math.max(1, Math.round(msAgo / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  return `${hours}h ago`
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

  return (
    <div>
      {stale ? (
        <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
          Updated {formatRelative(age)}
        </div>
      ) : null}
      {children}
    </div>
  )
}
