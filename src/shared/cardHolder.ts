/**
 * Allocard-side card holder. Airwallex sees an org DELEGATE; the employee is
 * `accessList[0]` (and anyone else on the list may Reveal under OWN).
 */
export function cardHolderUserId(card: { accessList: readonly string[] }): string | null {
  const id = card.accessList[0]
  if (id === undefined || id.length < 1) {
    return null
  }
  return id
}

/** Permission subject `userId`: caller if they are on the list, else the holder. */
export function cardPermissionUserId(
  card: { accessList: readonly string[] },
  callerUserId: string,
): string | undefined {
  if (card.accessList.includes(callerUserId)) {
    return callerUserId
  }
  return cardHolderUserId(card) ?? undefined
}
