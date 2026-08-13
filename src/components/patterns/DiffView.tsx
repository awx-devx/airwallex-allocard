import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import type { DiffViewProps } from '@/components/patterns/types'
import { cn } from '@/lib/utils'

export type DiffEntry = {
  key: string
  before: unknown
  after: unknown
  changed: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMoney(value: unknown): value is { amount: number; currency: string } {
  if (!isPlainObject(value)) return false
  return (
    typeof value.amount === 'number' &&
    Number.isInteger(value.amount) &&
    typeof value.currency === 'string' &&
    value.currency.length === 3
  )
}

export function diffEntries(before: unknown | null, after: unknown | null): DiffEntry[] {
  const beforeObj = isPlainObject(before) ? before : {}
  const afterObj = isPlainObject(after) ? after : {}
  const keys = [...new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)])].sort()
  return keys.map((key) => {
    const b = beforeObj[key]
    const a = afterObj[key]
    return {
      key,
      before: b,
      after: a,
      changed: JSON.stringify(b) !== JSON.stringify(a),
    }
  })
}

function DiffValue({ value }: { value: unknown }) {
  if (isMoney(value)) return <MoneyDisplay money={value} />
  if (value === undefined) return <span className="text-muted-foreground">—</span>
  return <span className="font-mono text-xs">{JSON.stringify(value)}</span>
}

export function DiffView({ before, after }: DiffViewProps) {
  if (before === null && after === null) {
    return <p className="text-sm text-muted-foreground">No changes</p>
  }
  const entries = diffEntries(before, after)
  return (
    <dl className="space-y-2 text-sm">
      {entries.map((entry) => (
        <div
          key={entry.key}
          className={cn(
            'grid grid-cols-3 gap-2 rounded-md p-2',
            entry.changed ? 'bg-status-warning/10' : 'text-muted-foreground',
          )}
        >
          <dt className="font-medium">{entry.key}</dt>
          <dd>
            <DiffValue value={entry.before} />
          </dd>
          <dd>
            <DiffValue value={entry.after} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
