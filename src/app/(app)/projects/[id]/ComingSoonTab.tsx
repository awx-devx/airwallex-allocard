'use client'

export function ComingSoonTab({ tab, phase }: { tab: string; phase: string }) {
  return (
    <main className="min-w-0">
      {tab} lands in {phase}.
    </main>
  )
}
