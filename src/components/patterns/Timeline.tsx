import { CogIcon, CreditCardIcon, UserIcon, ZapIcon } from 'lucide-react'
import { timelineActorChipLabel } from '@/components/patterns/timelineActor'
import type { TimelineItem, TimelineProps } from '@/components/patterns/types'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/client/states/EmptyState'
import { LoadingState } from '@/client/states/LoadingState'
import { formatDateTime } from '@/lib/dates'
import { ActorType } from '@/shared/enums/audit'

const ACTOR = {
  [ActorType.USER]: { icon: UserIcon, variant: 'neutral' as const },
  [ActorType.RULE]: { icon: ZapIcon, variant: 'warning' as const },
  [ActorType.SYSTEM]: { icon: CogIcon, variant: 'info' as const },
  [ActorType.AIRWALLEX]: {
    icon: CreditCardIcon,
    variant: 'secondary' as const,
  },
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const actor = ACTOR[item.actorType]
  const Icon = actor.icon
  return (
    <li className="flex min-w-0 flex-wrap items-start gap-2 py-3">
      <Badge variant={actor.variant} className="gap-1 self-start">
        <Icon className="size-3" />
        {timelineActorChipLabel(item.actorType, item.actorName)}
      </Badge>
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-sm wrap-anywhere">{item.summary}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
      </div>
    </li>
  )
}

export function Timeline({ items, loading, empty }: TimelineProps) {
  if (loading) return <LoadingState />
  if (items.length === 0 && empty) {
    return <EmptyState title={empty.title} description={empty.description} action={empty.action} />
  }
  return (
    <ol className="min-w-0 divide-y divide-border">
      {items.map((item) => (
        <TimelineRow key={item.id} item={item} />
      ))}
    </ol>
  )
}
