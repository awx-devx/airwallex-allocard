/**
 * PAN boundary: never accept, store, log, or render a full number or secret card details.
 * Reveal is a trigger callback only — A5 mounts the Airwallex iframe.
 */
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { CardVisualProps } from '@/components/patterns/types'
import { Button } from '@/components/ui/button'
import { formatMaskedCard } from '@/lib/format/cardNumber'

function humanisePurpose(purpose: string): string {
  return purpose
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

export function CardVisual({ nickName, maskedNumber, status, purpose, onReveal }: CardVisualProps) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card p-4 text-card-foreground">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{nickName}</div>
          {purpose ? (
            <div className="text-sm text-muted-foreground">{humanisePurpose(purpose)}</div>
          ) : null}
        </div>
        <StatusBadge kind="card" status={status} />
      </div>
      <div className="font-mono text-sm tracking-wide">{formatMaskedCard(maskedNumber)}</div>
      {onReveal ? (
        <Button type="button" variant="ghost" aria-label="Reveal card details" onClick={onReveal}>
          Reveal
        </Button>
      ) : null}
    </div>
  )
}
