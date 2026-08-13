import {
  cardStatusLabel,
  cardStatusVariant,
  projectStatusLabel,
  projectStatusVariant,
  purchaseRequestStatusLabel,
  purchaseRequestStatusVariant,
  ruleRunStatusLabel,
  ruleRunStatusVariant,
  type StatusVariant,
} from '@/lib/format/status'
import type { StatusBadgeProps } from '@/components/patterns/types'

export function statusBadgeVariant(props: StatusBadgeProps): StatusVariant {
  switch (props.kind) {
    case 'project':
      return projectStatusVariant(props.status)
    case 'card':
      return cardStatusVariant(props.status)
    case 'request':
      return purchaseRequestStatusVariant(props.status)
    case 'ruleRun':
      return ruleRunStatusVariant(props.status)
    default: {
      const _exhaustive: never = props
      return _exhaustive
    }
  }
}

export function statusBadgeLabel(props: StatusBadgeProps): string {
  switch (props.kind) {
    case 'project':
      return projectStatusLabel(props.status)
    case 'card':
      return cardStatusLabel(props.status)
    case 'request':
      return purchaseRequestStatusLabel(props.status)
    case 'ruleRun':
      return ruleRunStatusLabel(props.status)
    default: {
      const _exhaustive: never = props
      return _exhaustive
    }
  }
}
