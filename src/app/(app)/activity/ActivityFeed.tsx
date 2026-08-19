'use client'

import Link from 'next/link'
import { isApiError } from '@/client/api/errors'
import { useActivity } from '@/client/hooks/useReports'
import { toTimelineItem } from '@/client/lib/projects'
import { noActivityEmpty, transactionsHref } from '@/client/lib/transactions'
import { ErrorState } from '@/components/patterns/ErrorState'
import { PageFill } from '@/components/patterns/PageBody'
import { PageHeader } from '@/components/patterns/PageHeader'
import { Timeline, TimelinePanel } from '@/components/patterns/Timeline'
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
    <PageFill>
      <PageHeader
        title="Activity"
        actions={
          <Link href={transactionsHref()} className={buttonVariants({ variant: 'ghost' })}>
            Transactions
          </Link>
        }
      />
      <TimelinePanel title="Timeline" fill>
        <Timeline items={items} loading={query.isPending} empty={noActivityEmpty()} />
        {query.hasNextPage ? (
          <Button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            Load more
          </Button>
        ) : null}
      </TimelinePanel>
    </PageFill>
  )
}
