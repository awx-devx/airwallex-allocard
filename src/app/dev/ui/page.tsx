'use client'

import { JumpNav } from '@/app/dev/ui/JumpNav'
import { PatternGallery } from '@/app/dev/ui/PatternGallery'
import { PrimitiveGallery } from '@/app/dev/ui/sections/primitives'
import { ThemeToggle } from '@/app/dev/ui/ThemeToggle'
import { cn } from '@/lib/utils'

const TOKEN_SWATCHES: { name: string; className: string }[] = [
  { name: '--status-neutral', className: 'bg-status-neutral' },
  { name: '--status-neutral-foreground', className: 'bg-status-neutral-foreground' },
  { name: '--status-info', className: 'bg-status-info' },
  { name: '--status-info-foreground', className: 'bg-status-info-foreground' },
  { name: '--status-success', className: 'bg-status-success' },
  { name: '--status-success-foreground', className: 'bg-status-success-foreground' },
  { name: '--status-warning', className: 'bg-status-warning' },
  { name: '--status-warning-foreground', className: 'bg-status-warning-foreground' },
  { name: '--status-danger', className: 'bg-status-danger' },
  { name: '--status-danger-foreground', className: 'bg-status-danger-foreground' },
  { name: '--budget-committed', className: 'bg-budget-committed' },
  { name: '--budget-actual', className: 'bg-budget-actual' },
  { name: '--budget-remaining', className: 'bg-budget-remaining' },
  { name: '--budget-over', className: 'bg-budget-over' },
  { name: '--money-positive', className: 'bg-money-positive' },
  { name: '--money-negative', className: 'bg-money-negative' },
  { name: '--money-zero', className: 'bg-money-zero' },
  { name: '--laser', className: 'bg-laser' },
  { name: '--laser-cool', className: 'bg-laser-cool' },
]

export default function DevUiPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-medium">Allocard UI</h1>
        <div className="flex flex-wrap items-center gap-6">
          <JumpNav />
          <ThemeToggle />
        </div>
      </header>

      <section id="tokens" className="space-y-4">
        <h2 className="text-lg font-medium">Tokens</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {TOKEN_SWATCHES.map((token) => (
            <div key={token.name} className="flex items-center gap-2 text-sm">
              <div
                className={cn('size-8 shrink-0 rounded-md border border-border', token.className)}
              />
              <code>{token.name}</code>
            </div>
          ))}
        </div>
      </section>

      <section id="primitives" className="space-y-8">
        <h2 className="text-lg font-medium">Primitives</h2>
        <PrimitiveGallery />
      </section>

      <section id="patterns" className="space-y-8">
        <h2 className="text-lg font-medium">Patterns</h2>
        <PatternGallery />
      </section>
    </div>
  )
}
