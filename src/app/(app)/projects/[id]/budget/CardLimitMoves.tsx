'use client'

import Link from 'next/link'
import {
  cardLimitDiffToDiffView,
  cardsTabHref,
  noCardLimitsMovedMessage,
  type CardTransactionLimitDiff,
} from '@/client/lib/budget'
import { DiffView } from '@/components/patterns/DiffView'

export function CardLimitMoves({
  diffs,
  cardTotal,
  projectId,
}: {
  diffs: ReadonlyArray<CardTransactionLimitDiff>
  cardTotal: number
  projectId: string
}) {
  if (diffs.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-2 text-sm">
        <p>{noCardLimitsMovedMessage()}</p>
        {cardTotal === 0 ? (
          <p>
            No cards yet.{' '}
            <Link href={cardsTabHref(projectId)} className="underline-offset-4 hover:underline">
              Cards
            </Link>
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h2 className="text-sm font-medium">Card limits that moved</h2>
      <DiffView {...cardLimitDiffToDiffView(diffs)} />
    </div>
  )
}
