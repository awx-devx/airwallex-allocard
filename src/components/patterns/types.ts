/**
 * F3 pattern prop contracts. Rename here first — screens and later tasks copy these shapes.
 *
 * PermissionGate / PermissionGateView are UX only, never a security control.
 * Server `requirePermission` is authoritative.
 */
import type { ReactNode } from 'react'
import type { RequirePermissionProps } from '@/client/lib/permissions/RequirePermission'
import type { EmptyStateProps } from '@/client/states/EmptyState'
import type { RuleSentenceInput } from '@/lib/rules/sentence'
import type { PermissionSubject } from '@/shared/access/scope'
import type { ActorType } from '@/shared/enums/audit'
import type { CardPurpose } from '@/shared/enums/cardPurpose'
import type { CardStatus } from '@/shared/enums/cardStatus'
import type { ErrorCode } from '@/shared/enums/errors'
import type { Permission } from '@/shared/enums/permissions'
import type { ProjectStatus } from '@/shared/enums/projectStatus'
import type { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { Money } from '@/shared/schemas/base'
import type { PermissionReason } from '@/shared/types/projectMember'

export type { EmptyStateProps }
export type { Money, Permission, PermissionReason, PermissionSubject }

export type MoneyDisplayProps = {
  money: Money
  compact?: boolean
  colorBySign?: boolean
}

export type StatusBadgeProps =
  | { kind: 'project'; status: ProjectStatus }
  | { kind: 'card'; status: CardStatus }
  | { kind: 'request'; status: PurchaseRequestStatus }
  | { kind: 'ruleRun'; status: RuleRunStatus }

export type BudgetBarProps = {
  currency: string
  approved: number
  committed: number
  actual: number
  remaining: number
  utilisationPct?: number
  overCommitted?: boolean
}

export type LimitMeterProps = {
  interval: TransactionLimitInterval
  amount: number
  remaining: number
  currency: string
}

export type AttributeValueProps = {
  value: number | string | boolean | null
  observedAt: string
  ttlSec: number | null
  unit?: string | null
  label?: string
  now?: Date
}

export type PermissionGateViewProps = {
  allowed: boolean
  denialMessage: string
  children: ReactNode
  fallback?: ReactNode
}

export type PermissionGateProps = RequirePermissionProps

export type CardVisualProps = {
  nickName: string
  maskedNumber: string
  status: CardStatus
  purpose?: CardPurpose
  onReveal?: () => void
}

export type TimelineItem = {
  id: string
  at: string
  actorType: ActorType
  actorId: string
  actorName?: string
  summary: string
  subjectType?: string
  subjectId?: string
}

export type TimelineProps = {
  items: TimelineItem[]
  loading?: boolean
  empty?: {
    title: string
    description: string
    action?: { label: string; onClick: () => void }
  }
}

export type RuleSentenceProps = {
  rule: RuleSentenceInput
}

export type FormulaHighlightProps = {
  expression: string
}

export type DiffViewProps = {
  before: unknown | null
  after: unknown | null
}

/** F3.19 adds `code` to the F0 component; this is the pattern contract. */
export type ErrorStateProps = {
  message: string
  onRetry?: () => void
  code?: ErrorCode
}

export type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  variant: 'default' | 'destructive'
  typeToConfirm?: { phrase: string; prompt: string }
  onConfirm: () => void
  loading?: boolean
}

export type StepWizardStep = {
  id: string
  label: string
  optional?: boolean
}

export type StepWizardProps = {
  steps: StepWizardStep[]
  activeStepId: string
  isStepValid: (id: string) => boolean
  isDirty?: boolean
  onNext: () => void
  onBack: () => void
  onCancel?: () => void
  children: ReactNode
}

export type DataTableColumn<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortable?: boolean
}

export type DataTablePagination =
  | {
      mode: 'cursor'
      nextCursor: string | null
      onLoadMore: () => void
      isFetchingMore?: boolean
    }
  | {
      mode: 'page'
      page: number
      pageSize: number
      total: number
      onPageChange: (page: number) => void
    }

export type DataTableSorting = { id: string; direction: 'asc' | 'desc' }

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  sorting?: DataTableSorting | null
  onSortingChange?: (next: DataTableSorting | null) => void
  pagination: DataTablePagination
  rowSelection?: { selectedIds: string[]; onChange: (ids: string[]) => void }
  columnVisibility?: { hiddenIds: string[]; onChange: (hiddenIds: string[]) => void }
  loading?: boolean
  error?: { message: string; onRetry?: () => void }
  empty: {
    title: string
    description: string
    action?: { label: string; onClick: () => void }
  }
  toolbar?: ReactNode
}
