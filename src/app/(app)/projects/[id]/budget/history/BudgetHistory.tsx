'use client'

import { useParams } from 'next/navigation'
import { isApiError } from '@/client/api/errors'
import { useBudgetHistory } from '@/client/hooks/useBudget'
import { budgetHistoryReason, toBudgetHistoryTimelineItem } from '@/client/lib/budget'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { PageFill } from '@/components/patterns/PageBody'
import { Timeline, TimelinePanel } from '@/components/patterns/Timeline'
import { ErrorCode } from '@/shared/enums/errors'

export function BudgetHistory() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const history = useBudgetHistory(id)

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (history.isPending) {
    return <LoadingState />
  }

  if (history.error) {
    if (isApiError(history.error) && history.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={isApiError(history.error) ? history.error.message : 'Unable to load history'}
      />
    )
  }

  const items = (history.data ?? []).map((entry) => {
    const item = toBudgetHistoryTimelineItem(entry)
    const reason = budgetHistoryReason(entry)
    return reason ? { ...item, summary: `${item.summary} — ${reason}` } : item
  })

  return (
    <PageFill>
      <TimelinePanel title="History" fill>
        <Timeline
          items={items}
          empty={{
            title: 'No budget changes yet',
            description: 'Approved amount, categories, and requests will show up here.',
          }}
        />
      </TimelinePanel>
    </PageFill>
  )
}
