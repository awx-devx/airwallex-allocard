'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { CreditCardIcon, EyeIcon } from 'lucide-react'
import { isApiError } from '@/client/api/errors'
import { useProjectCards } from '@/client/hooks/useCards'
import { useProject } from '@/client/hooks/useProjects'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  canRevealCard,
  cardHref,
  cardRevealHref,
  controlsHref,
  parseProjectCardListSearchParams,
  projectCardListHref,
  revealCardDenialMessage,
} from '@/client/lib/cards'
import { useCan } from '@/client/lib/permissions/useCan'
import { isProjectArchived } from '@/client/lib/reports'
import { CardVisual } from '@/components/patterns/CardVisual'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import { Button, buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { pageNextParam } from '@/lib/pagination'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import type { Card } from '@/shared/types/card'

const ALL = '__all__'

function RevealControl({ card, allowed }: { card: Card; allowed: boolean }) {
  const eligible = canRevealCard(card.status, card.airwallexCardId)
  if (!allowed) {
    return (
      <PermissionGateView allowed={false} denialMessage={revealCardDenialMessage()}>
        <Button type="button" variant="outline" disabled>
          <EyeIcon className="size-4 shrink-0" aria-hidden />
          Reveal
        </Button>
      </PermissionGateView>
    )
  }
  if (!eligible) {
    return (
      <Button type="button" variant="outline" disabled>
        <EyeIcon className="size-4 shrink-0" aria-hidden />
        Reveal
      </Button>
    )
  }
  return (
    <Link href={cardRevealHref(card.id)} className={buttonVariants({ variant: 'outline' })}>
      <EyeIcon className="size-4 shrink-0" aria-hidden />
      Reveal
    </Link>
  )
}

export function ProjectCards() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseProjectCardListSearchParams({
    status: params.get('status') ?? undefined,
    purpose: params.get('purpose') ?? undefined,
    page: params.get('page') ?? undefined,
    pageSize: params.get('pageSize') ?? undefined,
  })
  const query = useProjectCards(id, filter)
  const project = useProject(id)
  const { can, isLoading } = useCan(id)
  const archived = isProjectArchived(project.data?.status ?? '')

  function pushFilter(next: typeof filter) {
    router.push(projectCardListHref(id, next))
  }

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load cards'}
      />
    )
  }

  const total = query.data?.total ?? 0
  const page = query.data?.page ?? filter.page
  const pageSize = query.data?.pageSize ?? filter.pageSize
  const items = query.data?.items ?? []

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select
            value={filter.status ?? ALL}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                status: value === ALL ? undefined : (value as CardStatus),
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Status" size="sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {Object.values(CardStatus).map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Purpose</Label>
          <Select
            value={filter.purpose ?? ALL}
            onValueChange={(value) =>
              pushFilter({
                ...filter,
                purpose: value === ALL ? undefined : (value as CardPurpose),
                page: 1,
              })
            }
          >
            <SelectTrigger aria-label="Purpose" size="sm">
              <SelectValue placeholder="All purposes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {Object.values(CardPurpose).map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {purpose}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {query.isPending ? (
        <LoadingState />
      ) : total === 0 ? (
        <div className="flex min-w-0 flex-col items-center gap-3">
          <EmptyState
            title="No cards yet"
            description="Cards are issued by rules when this project launches."
            illustration={<CreditCardIcon className="size-8 text-muted-foreground" aria-hidden />}
          />
          <Link href={controlsHref(id)} className={buttonVariants({ variant: 'outline' })}>
            View controls
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((card) => {
              const revealAllowed = permissionGateAllowed(
                can(Permission.CARD_VIEW_DETAILS, { cardId: card.id }),
                isLoading,
              )
              return (
                <li key={card.id} className="flex min-w-0 flex-col gap-2">
                  <CardVisual
                    nickName={card.nickName}
                    maskedNumber={card.maskedNumber}
                    status={card.status}
                    purpose={card.purpose}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={cardHref(card.id)}
                      className={buttonVariants({ variant: 'outline' })}
                    >
                      Open
                    </Link>
                    {archived ? null : <RevealControl card={card} allowed={revealAllowed} />}
                  </div>
                </li>
              )
            })}
          </ul>
          {total > pageSize ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={page <= 1}
                onClick={() => pushFilter({ ...filter, page: page - 1 })}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pageNextParam({ page, pageSize, total }) === undefined}
                onClick={() => pushFilter({ ...filter, page: page + 1 })}
              >
                Next
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
