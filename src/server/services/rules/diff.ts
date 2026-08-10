/**
 * Pipeline step 6 — diff desired against applied (RULES-ENGINE §4). Pure.
 *
 * Only fields a rule actually contributed are compared. A rule that says nothing
 * about merchant categories must not read as "clear the merchant categories":
 * desired state is recomputed wholesale, but it is still a statement about the
 * fields it covers.
 */
import type { CardControls } from '@/shared/types/cardControls'
import type { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import type { CardControlsDiff, DesiredCardState, RuleRunDiff } from '@/shared/types/ruleRun'

export type AppliedCardState = {
  cardId: string
  controls: CardControls
  cardStatus: DesiredCardStatus | null
}

type PartialControls = NonNullable<DesiredCardState['controls']>

function sameValue(desired: unknown, applied: unknown): boolean {
  return JSON.stringify(desired ?? null) === JSON.stringify(applied ?? null)
}

/** True when any field the rules contributed differs from what is applied. */
export function controlsChanged(desired: PartialControls, applied: CardControls): boolean {
  return (Object.keys(desired) as Array<keyof PartialControls>).some(
    (field) => !sameValue(desired[field], applied[field as keyof CardControls]),
  )
}

export function diffCard(desired: DesiredCardState, applied: AppliedCardState): CardControlsDiff {
  const controlsDiffer = desired.controls
    ? controlsChanged(desired.controls, applied.controls)
    : false
  const statusDiffers =
    desired.cardStatus !== undefined && desired.cardStatus !== applied.cardStatus

  return {
    cardId: desired.cardId,
    before: {
      controls: applied.controls,
      cardStatus: applied.cardStatus,
    },
    after: {
      controls: desired.controls ?? null,
      cardStatus: desired.cardStatus ?? null,
    },
    changed: controlsDiffer || statusDiffers,
  }
}

/** Diff every card in the desired state. Cards with no applied state are skipped. */
export function diffDesiredState(
  desiredCards: readonly DesiredCardState[],
  applied: readonly AppliedCardState[],
): RuleRunDiff {
  const appliedById = new Map(applied.map((entry) => [entry.cardId, entry]))
  const cards: CardControlsDiff[] = []

  for (const desired of desiredCards) {
    const current = appliedById.get(desired.cardId)
    if (!current) {
      continue
    }
    cards.push(diffCard(desired, current))
  }

  return { cards }
}
