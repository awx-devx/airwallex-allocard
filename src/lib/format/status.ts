/**
 * Status labels and badge variants for F3 StatusBadge.
 *
 * Variant mapping:
 * - success: ACTIVE, APPROVED, SUCCESS
 * - info: DRAFT, PENDING, PENDING_APPROVAL, DRY_RUN
 * - warning: CLOSING, PARTIAL, INACTIVE
 * - neutral: CLOSED, ARCHIVED
 * - danger: CANCELLED, REJECTED, EXPIRED, FAILED, BLOCKED, LOST, STOLEN, SKIPPED
 */
import { CardStatus } from '@/shared/enums/cardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'

export type StatusVariant = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

function humaniseEnum(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}

export function projectStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case ProjectStatus.DRAFT:
      return 'Draft'
    case ProjectStatus.PENDING_APPROVAL:
      return 'Pending approval'
    case ProjectStatus.ACTIVE:
      return 'Active'
    case ProjectStatus.CLOSING:
      return 'Closing'
    case ProjectStatus.CLOSED:
      return 'Closed'
    case ProjectStatus.ARCHIVED:
      return 'Archived'
    case ProjectStatus.CANCELLED:
      return 'Cancelled'
    default: {
      const _exhaustive: never = status
      return humaniseEnum(String(_exhaustive))
    }
  }
}

export function projectStatusVariant(status: ProjectStatus): StatusVariant {
  switch (status) {
    case ProjectStatus.DRAFT:
    case ProjectStatus.PENDING_APPROVAL:
      return 'info'
    case ProjectStatus.ACTIVE:
      return 'success'
    case ProjectStatus.CLOSING:
      return 'warning'
    case ProjectStatus.CLOSED:
    case ProjectStatus.ARCHIVED:
      return 'neutral'
    case ProjectStatus.CANCELLED:
      return 'danger'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function cardStatusLabel(status: CardStatus): string {
  switch (status) {
    case CardStatus.PENDING:
      return 'Pending'
    case CardStatus.ACTIVE:
      return 'Active'
    case CardStatus.INACTIVE:
      return 'Inactive'
    case CardStatus.CLOSED:
      return 'Closed'
    case CardStatus.BLOCKED:
      return 'Blocked'
    case CardStatus.LOST:
      return 'Lost'
    case CardStatus.STOLEN:
      return 'Stolen'
    case CardStatus.FAILED:
      return 'Failed'
    default: {
      const _exhaustive: never = status
      return humaniseEnum(String(_exhaustive))
    }
  }
}

export function cardStatusVariant(status: CardStatus): StatusVariant {
  switch (status) {
    case CardStatus.PENDING:
      return 'info'
    case CardStatus.ACTIVE:
      return 'success'
    case CardStatus.INACTIVE:
      return 'warning'
    case CardStatus.CLOSED:
      return 'neutral'
    case CardStatus.BLOCKED:
    case CardStatus.LOST:
    case CardStatus.STOLEN:
    case CardStatus.FAILED:
      return 'danger'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function purchaseRequestStatusLabel(status: PurchaseRequestStatus): string {
  switch (status) {
    case PurchaseRequestStatus.DRAFT:
      return 'Draft'
    case PurchaseRequestStatus.PENDING:
      return 'Pending'
    case PurchaseRequestStatus.APPROVED:
      return 'Approved'
    case PurchaseRequestStatus.REJECTED:
      return 'Rejected'
    case PurchaseRequestStatus.EXPIRED:
      return 'Expired'
    case PurchaseRequestStatus.CANCELLED:
      return 'Cancelled'
    default: {
      const _exhaustive: never = status
      return humaniseEnum(String(_exhaustive))
    }
  }
}

export function purchaseRequestStatusVariant(status: PurchaseRequestStatus): StatusVariant {
  switch (status) {
    case PurchaseRequestStatus.DRAFT:
    case PurchaseRequestStatus.PENDING:
      return 'info'
    case PurchaseRequestStatus.APPROVED:
      return 'success'
    case PurchaseRequestStatus.REJECTED:
    case PurchaseRequestStatus.EXPIRED:
    case PurchaseRequestStatus.CANCELLED:
      return 'danger'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

export function ruleRunStatusLabel(status: RuleRunStatus): string {
  switch (status) {
    case RuleRunStatus.SUCCESS:
      return 'Success'
    case RuleRunStatus.PARTIAL:
      return 'Partial'
    case RuleRunStatus.FAILED:
      return 'Failed'
    case RuleRunStatus.SKIPPED:
      return 'Skipped'
    case RuleRunStatus.DRY_RUN:
      return 'Dry run'
    default: {
      const _exhaustive: never = status
      return humaniseEnum(String(_exhaustive))
    }
  }
}

export function ruleRunStatusVariant(status: RuleRunStatus): StatusVariant {
  switch (status) {
    case RuleRunStatus.SUCCESS:
      return 'success'
    case RuleRunStatus.PARTIAL:
      return 'warning'
    case RuleRunStatus.DRY_RUN:
      return 'info'
    case RuleRunStatus.FAILED:
    case RuleRunStatus.SKIPPED:
      return 'danger'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}
