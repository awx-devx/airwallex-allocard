/**
 * PAN boundary: never accept, store, log, or render a full number or secret card details.
 * Reveal is a trigger callback only — A5 mounts the Airwallex iframe.
 * Visual: ID-1 plastic silhouette — no secret fields on the face.
 */
import { StatusBadge } from '@/components/patterns/StatusBadge'
import type { CardVisualProps } from '@/components/patterns/types'
import { Button } from '@/components/ui/button'
import { formatMaskedCard } from '@/lib/format/cardNumber'
import { cn } from '@/lib/utils'

function humanisePurpose(purpose: string): string {
  return purpose
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

/** Group masked display for readability — never invents digits. */
function displayMasked(maskedNumber: string): string {
  const compact = formatMaskedCard(maskedNumber).replace(/\s+/g, '')
  return compact.replace(/(.{4})(?=.)/g, '$1 ').trim()
}

function CardChip({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative h-9 w-11 shrink-0 overflow-hidden rounded-sm',
        'bg-linear-to-br from-status-warning via-status-warning/85 to-status-warning/65',
        'shadow-[inset_0_1px_0_0_hsl(var(--gloss-highlight)/0.45)] ring-1 ring-primary/20',
        className,
      )}
    >
      <span className="absolute inset-x-0 top-[32%] h-px bg-primary/25" />
      <span className="absolute inset-x-0 top-[58%] h-px bg-primary/20" />
      <span className="absolute inset-y-0 left-[32%] w-px bg-primary/25" />
      <span className="absolute inset-y-0 left-[58%] w-px bg-primary/20" />
      <span className="absolute inset-[18%] rounded-[2px] border border-primary/15" />
    </div>
  )
}

function ContactlessMark({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative size-7 text-primary-foreground/70', className)}>
      <span className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current opacity-80" />
      <span className="absolute top-1/2 left-[42%] h-3.5 w-3.5 -translate-y-1/2 rounded-full border-2 border-current border-l-transparent opacity-70" />
      <span className="absolute top-1/2 left-[30%] h-5 w-5 -translate-y-1/2 rounded-full border-2 border-current border-l-transparent opacity-45" />
      <span className="absolute top-1/2 left-[18%] size-6 -translate-y-1/2 rounded-full border-2 border-current border-l-transparent opacity-25" />
    </div>
  )
}

export function CardVisual({
  nickName,
  maskedNumber,
  status,
  purpose,
  onReveal,
  validThru,
}: CardVisualProps) {
  return (
    <div
      className={cn(
        'relative flex w-full max-w-[22rem] flex-col justify-between overflow-hidden',
        'aspect-[1.586] rounded-xl p-4 text-primary-foreground',
        'border border-gloss-highlight/15',
        'bg-linear-to-br from-primary via-primary to-primary/80',
        'shadow-[var(--shadow-gloss-primary)]',
      )}
    >
      {/* Gloss sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-br from-gloss-highlight/25 via-transparent to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-1/4 -right-1/4 size-[70%] rounded-full bg-status-info/20 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold tracking-[0.22em] uppercase opacity-80">
            Allocard
          </p>
          {purpose ? (
            <p className="mt-0.5 truncate text-xs text-primary-foreground/70">
              {humanisePurpose(purpose)}
            </p>
          ) : null}
        </div>
        <StatusBadge kind="card" status={status} />
      </div>

      <div className="relative mt-3 flex items-center gap-3">
        <CardChip />
        <ContactlessMark />
      </div>

      <div className="relative mt-auto space-y-3 pt-4">
        <p className="font-mono text-base tracking-[0.18em] tabular-nums md:text-lg">
          {displayMasked(maskedNumber)}
        </p>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] tracking-wider uppercase text-primary-foreground/55">
              Name
            </p>
            <p className="truncate text-sm font-medium tracking-wide uppercase">{nickName}</p>
          </div>
          {validThru ? (
            <div className="shrink-0 text-right">
              <p className="text-[0.6rem] tracking-wider uppercase text-primary-foreground/55">
                Valid thru
              </p>
              <p className="font-mono text-sm tabular-nums">{validThru}</p>
            </div>
          ) : onReveal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 border border-gloss-highlight/20 bg-gloss-highlight/10 text-primary-foreground hover:bg-gloss-highlight/20 hover:text-primary-foreground"
              aria-label="Reveal card details"
              onClick={onReveal}
            >
              Reveal
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
