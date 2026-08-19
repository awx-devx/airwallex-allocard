'use client'

import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useProjectActivity } from '@/client/hooks/useReports'
import { toTimelineItem } from '@/client/lib/projects'
import { noProjectActivityEmpty, parseOptionalIdParam } from '@/client/lib/transactions'
import { ErrorState } from '@/components/patterns/ErrorState'
import { Timeline } from '@/components/patterns/Timeline'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorCode } from '@/shared/enums/errors'

export function ProjectActivity() {
  const raw = useParams().id
  const id =
    parseOptionalIdParam(typeof raw === 'string' ? raw : Array.isArray(raw) ? raw : undefined) ?? ''
  const query = useProjectActivity(id, { limit: 20 })
  const items = (query.data?.pages.flatMap((page) => page.items) ?? []).map(toTimelineItem)

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (query.error) {
    if (isApiError(query.error) && query.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={isApiError(query.error) ? query.error.message : 'Unable to load activity'}
      />
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <Timeline items={items} loading={query.isPending} empty={noProjectActivityEmpty()} />
        {query.hasNextPage ? (
          <Button
            type="button"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            Load more
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
