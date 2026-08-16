'use client'

import Link from 'next/link'
import { isApiError } from '@/client/api/errors'
import { useActivity } from '@/client/hooks/useReports'
import { toTimelineItem } from '@/client/lib/projects'
import { noActivityEmpty, transactionsHref } from '@/client/lib/transactions'
import { ErrorState } from '@/components/patterns/ErrorState'
import { Timeline } from '@/components/patterns/Timeline'
import { Button, buttonVariants } from '@/components/ui/button'

export function ActivityFeed() {
  const query = useActivity({ limit: 20 })
  const items = (query.data?.pages.flatMap((page) => page.items) ?? []).map(toTimelineItem)

  if (query.error) {
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load activity'}
      />
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Timeline items={items} loading={query.isPending} empty={noActivityEmpty()} />
      <div className="flex flex-wrap gap-2">
        {query.hasNextPage ? (
          <Button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            Load more
          </Button>
        ) : null}
        <Link href={transactionsHref()} className={buttonVariants({ variant: 'ghost' })}>
          Transactions
        </Link>
      </div>
    </div>
  )
}
