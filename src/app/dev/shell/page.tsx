'use client'

import { AppShell } from '@/client/shell/AppShell'
import { mockShellData } from '@/client/shell/mockShellData'
import { EmptyState } from '@/client/states/EmptyState'
import { ErrorState } from '@/client/states/ErrorState'
import { LoadingState } from '@/client/states/LoadingState'
import { PartialState } from '@/client/states/PartialState'

const AS_OF = '2026-08-12T12:00:00.000Z'
const FRESH_OBSERVED = '2026-08-12T11:55:00.000Z'
const STALE_OBSERVED = '2026-08-12T11:00:00.000Z'

export default function DevShellPage() {
  return (
    <AppShell
      memberships={[...mockShellData.memberships]}
      activeOrgId={mockShellData.activeOrgId}
      user={{ ...mockShellData.user }}
      approvalsCount={mockShellData.approvalsCount}
      project={{ ...mockShellData.project }}
    >
      <h1 className="mb-6 text-xl font-medium">Dev shell gallery</h1>

      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-medium">Loading</h2>
        <LoadingState rows={4} />
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-medium">Empty</h2>
        <EmptyState
          title="No projects yet"
          description="Create a project to get started."
          action={{ label: 'Create project', onClick: () => undefined }}
        />
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-medium">Error</h2>
        <ErrorState message="Upstream error" onRetry={() => undefined} />
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="text-lg font-medium">Partial (fresh)</h2>
        <PartialState observedAt={FRESH_OBSERVED} asOf={AS_OF}>
          <p>Headcount: 12</p>
        </PartialState>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Partial (stale)</h2>
        <PartialState observedAt={STALE_OBSERVED} asOf={AS_OF}>
          <p>Headcount: 12</p>
        </PartialState>
      </section>
    </AppShell>
  )
}
