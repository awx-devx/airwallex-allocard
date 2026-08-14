'use client'

import { useState } from 'react'

import {
  attributeFresh,
  attributeStale,
  attributeTtlNull,
  budgetFull,
  budgetHealthy,
  budgetOver,
  budgetZero,
  budgetZeroWithSpend,
  cardAws,
  cardStatuses,
  limitEmpty,
  limitFull,
  limitJpyMonthly,
  limitOver,
  diffAudit,
  diffCardControls,
  freezeOnUtilisationRule,
  moneyJpy,
  moneyNegative,
  moneyUsd,
  tableProjects,
  timelineItems,
} from '@/app/dev/ui/fixtures'
import { AttributeValue } from '@/components/patterns/AttributeValue'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { CardVisual } from '@/components/patterns/CardVisual'
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog'
import { LimitMeter } from '@/components/patterns/LimitMeter'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { StatusBadge } from '@/components/patterns/StatusBadge'
import { StepWizard } from '@/components/patterns/StepWizard'
import { DataTable } from '@/components/patterns/DataTable'
import { DiffView } from '@/components/patterns/DiffView'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { FormulaHighlight } from '@/components/patterns/FormulaHighlight'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PartialState } from '@/components/patterns/PartialState'
import { RuleSentence } from '@/components/patterns/RuleSentence'
import { Timeline } from '@/components/patterns/Timeline'
import { toastStore } from '@/client/providers/toastStore'
import { Button } from '@/components/ui/button'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'

export function PatternGallery() {
  return (
    <>
      <section id="money-display" className="space-y-2">
        <h3 className="font-medium">MoneyDisplay</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <MoneyDisplay money={moneyUsd} />
          <MoneyDisplay money={moneyUsd} compact />
          <MoneyDisplay money={moneyJpy} />
          <MoneyDisplay money={moneyNegative} />
          <MoneyDisplay money={{ amount: 0, currency: 'USD' }} />
        </div>
      </section>

      <section id="status-badge" className="space-y-3">
        <h3 className="font-medium">StatusBadge</h3>
        <div className="flex flex-wrap gap-2">
          {Object.values(ProjectStatus).map((status) => (
            <StatusBadge key={`p-${status}`} kind="project" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(CardStatus).map((status) => (
            <StatusBadge key={`c-${status}`} kind="card" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(PurchaseRequestStatus).map((status) => (
            <StatusBadge key={`r-${status}`} kind="request" status={status} />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.values(RuleRunStatus).map((status) => (
            <StatusBadge key={`rr-${status}`} kind="ruleRun" status={status} />
          ))}
        </div>
      </section>

      <section id="budget-bar" className="space-y-4">
        <h3 className="font-medium">BudgetBar</h3>
        <BudgetBar {...budgetHealthy} />
        <BudgetBar {...budgetOver} />
        <BudgetBar {...budgetZero} />
        <BudgetBar {...budgetZeroWithSpend} />
        <BudgetBar {...budgetFull} />
      </section>

      <section id="limit-meter" className="space-y-4">
        <h3 className="font-medium">LimitMeter</h3>
        <LimitMeter {...limitEmpty} />
        <LimitMeter {...limitFull} />
        <LimitMeter {...limitOver} />
        <LimitMeter {...limitJpyMonthly} />
      </section>

      <section id="attribute-value" className="space-y-4">
        <h3 className="font-medium">AttributeValue</h3>
        <AttributeValue {...attributeFresh} />
        <AttributeValue {...attributeStale} />
        <AttributeValue {...attributeTtlNull} />
      </section>

      <section id="permission-gate" className="space-y-4">
        <h3 className="font-medium">PermissionGate</h3>
        <PermissionGateView allowed denialMessage="unused">
          <Button type="button">Create card</Button>
        </PermissionGateView>
        <PermissionGateView allowed={false} denialMessage="Missing card.create">
          <Button type="button" disabled>
            Create card
          </Button>
        </PermissionGateView>
        <PermissionGateView allowed={false} denialMessage="Outside your access scope">
          <Button type="button" disabled>
            Create card
          </Button>
        </PermissionGateView>
      </section>

      <section id="card-visual" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <h3 className="font-medium md:col-span-2">CardVisual</h3>
        <CardVisual
          {...cardAws}
          onReveal={() => toastStore.info('Reveal opens the Airwallex iframe in A5')}
        />
        {cardStatuses.map((status) => (
          <CardVisual
            key={status}
            nickName={cardAws.nickName}
            maskedNumber={cardAws.maskedNumber}
            status={status}
            purpose={cardAws.purpose}
          />
        ))}
      </section>

      <section id="timeline" className="space-y-4">
        <h3 className="font-medium">Timeline</h3>
        <Timeline items={timelineItems} />
        <Timeline items={[]} loading />
        <Timeline
          items={[]}
          empty={{ title: 'No activity yet', description: 'Events will appear here.' }}
        />
      </section>

      <section id="rule-sentence" className="space-y-2">
        <h3 className="font-medium">RuleSentence</h3>
        <RuleSentence rule={freezeOnUtilisationRule} />
      </section>

      <section id="formula-highlight" className="space-y-2">
        <h3 className="font-medium">FormulaHighlight</h3>
        <FormulaHighlight expression="project.budget.remaining / project.headcount" />
      </section>

      <section id="diff-view" className="space-y-4">
        <h3 className="font-medium">DiffView</h3>
        <DiffView before={diffAudit.before} after={diffAudit.after} />
        <DiffView before={diffCardControls.before} after={diffCardControls.after} />
      </section>

      <section id="empty-state" className="space-y-2">
        <h3 className="font-medium">EmptyState</h3>
        <EmptyState
          title="No projects yet"
          description="Create a project to get started."
          action={{ label: 'Create project', onClick: () => undefined }}
        />
      </section>

      <section id="error-state" className="space-y-4">
        <h3 className="font-medium">ErrorState</h3>
        <ErrorState
          message="Airwallex is unavailable"
          code={ErrorCode.UPSTREAM_ERROR}
          onRetry={() => undefined}
        />
        <ErrorState
          message="Project not found"
          code={ErrorCode.NOT_FOUND}
          onRetry={() => undefined}
        />
        <ErrorState
          message="Missing card.create"
          code={ErrorCode.PERMISSION_DENIED}
          onRetry={() => undefined}
        />
      </section>

      <section id="loading-state" className="space-y-2">
        <h3 className="font-medium">LoadingState</h3>
        <LoadingState rows={4} />
      </section>

      <section id="partial-state" className="space-y-4">
        <h3 className="font-medium">PartialState</h3>
        <PartialState observedAt="2026-08-14T10:50:00.000Z" asOf="2026-08-14T10:55:00.000Z">
          <p>Headcount: 12</p>
        </PartialState>
        <PartialState observedAt="2026-08-14T09:00:00.000Z" asOf="2026-08-14T10:55:00.000Z">
          <p>Headcount: 12</p>
        </PartialState>
      </section>
      <ConfirmDialogDemo />
      <StepWizardDemo />
      <DataTableDemo />
    </>
  )
}

function ConfirmDialogDemo() {
  const [freezeOpen, setFreezeOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  return (
    <section id="confirm-dialog" className="space-y-3">
      <h3 className="font-medium">ConfirmDialog</h3>
      <div className="flex gap-2">
        <Button type="button" onClick={() => setFreezeOpen(true)}>
          Freeze card
        </Button>
        <Button type="button" variant="destructive" onClick={() => setCloseOpen(true)}>
          Close card
        </Button>
      </div>
      <ConfirmDialog
        open={freezeOpen}
        onOpenChange={setFreezeOpen}
        title="Freeze card"
        description="The card will decline new authorizations until unfrozen."
        confirmLabel="Freeze"
        variant="default"
        onConfirm={() => setFreezeOpen(false)}
      />
      <ConfirmDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        title="Close card"
        description="This cannot be undone at Airwallex. Pending transactions will still clear."
        confirmLabel="Close card"
        variant="destructive"
        typeToConfirm={{ phrase: 'CLOSE', prompt: 'Type CLOSE to confirm' }}
        onConfirm={() => setCloseOpen(false)}
      />
    </section>
  )
}

const WIZARD_STEPS = [
  { id: 'details', label: 'Details' },
  { id: 'budget', label: 'Budget' },
  { id: 'members', label: 'Members' },
  { id: 'roles', label: 'Roles' },
  { id: 'card-structure', label: 'Card structure' },
  { id: 'controls', label: 'Controls' },
  { id: 'approval-rules', label: 'Approval rules' },
  { id: 'review', label: 'Review' },
  { id: 'launch', label: 'Launch' },
]

function StepWizardDemo() {
  const [active, setActive] = useState('details')
  const [dirty, setDirty] = useState(false)
  const index = WIZARD_STEPS.findIndex((step) => step.id === active)
  return (
    <section id="step-wizard" className="space-y-3">
      <h3 className="font-medium">StepWizard</h3>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={dirty} onChange={(e) => setDirty(e.target.checked)} />
        Dirty
      </label>
      <StepWizard
        steps={WIZARD_STEPS}
        activeStepId={active}
        isStepValid={(id) => id === 'details' || id === 'budget'}
        isDirty={dirty}
        onNext={() => {
          const next = WIZARD_STEPS[index + 1]
          if (next) setActive(next.id)
        }}
        onBack={() => {
          const prev = WIZARD_STEPS[index - 1]
          if (prev) setActive(prev.id)
        }}
        onCancel={() => setActive('details')}
      >
        <p className="text-sm">Current step: {active}</p>
      </StepWizard>
    </section>
  )
}

function DataTableDemo() {
  const [sorting, setSorting] = useState<{ id: string; direction: 'asc' | 'desc' } | null>(null)
  const [hidden, setHidden] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const rows = [...tableProjects]
  type ProjectRow = (typeof rows)[number]
  const emptyRows: ProjectRow[] = []
  return (
    <section id="data-table" className="space-y-6">
      <h3 className="font-medium">DataTable</h3>
      <DataTable
        columns={[
          { id: 'name', header: 'Name', sortable: true, cell: (row) => row.name },
          { id: 'code', header: 'Code', sortable: true, cell: (row) => row.code },
          {
            id: 'status',
            header: 'Status',
            cell: (row) => <StatusBadge kind="project" status={row.status} />,
          },
        ]}
        rows={rows}
        getRowId={(row) => row.id}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: 20,
          total: 3,
          onPageChange: () => undefined,
        }}
        rowSelection={{ selectedIds: selected, onChange: setSelected }}
        columnVisibility={{ hiddenIds: hidden, onChange: setHidden }}
        empty={{ title: 'No projects', description: 'Create a project to get started.' }}
      />
      <DataTable
        columns={[{ id: 'name', header: 'Name', cell: (row) => row.name }]}
        rows={rows}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'cursor',
          nextCursor: 'opaque-cursor',
          onLoadMore: () => undefined,
        }}
        empty={{ title: 'No projects', description: 'Create a project to get started.' }}
      />
      <DataTable
        columns={[{ id: 'name', header: 'Name', cell: (row) => row.name }]}
        rows={emptyRows}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: 20,
          total: 0,
          onPageChange: () => undefined,
        }}
        empty={{ title: 'No projects', description: 'Create a project to get started.' }}
      />
      <DataTable
        columns={[{ id: 'name', header: 'Name', cell: (row) => row.name }]}
        rows={emptyRows}
        getRowId={(row) => row.id}
        loading
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: 20,
          total: 0,
          onPageChange: () => undefined,
        }}
        empty={{ title: 'No projects', description: 'Create a project to get started.' }}
      />
      <DataTable
        columns={[{ id: 'name', header: 'Name', cell: (row) => row.name }]}
        rows={emptyRows}
        getRowId={(row) => row.id}
        error={{ message: 'Failed to load projects', onRetry: () => undefined }}
        pagination={{
          mode: 'page',
          page: 1,
          pageSize: 20,
          total: 0,
          onPageChange: () => undefined,
        }}
        empty={{ title: 'No projects', description: 'Create a project to get started.' }}
      />
    </section>
  )
}
