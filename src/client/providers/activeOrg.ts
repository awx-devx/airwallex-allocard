const STORAGE_KEY = 'allocard:activeOrgId'
const USER_STORAGE_KEY = 'allocard:activeOrgUserId'

let activeOrgId: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function readStorageKey(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorageKey(key: string, value: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (value === null) {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch {
    // ignore quota / private mode
  }
}

function readStorage(): string | null {
  return readStorageKey(STORAGE_KEY)
}

function writeStorage(orgId: string | null): void {
  writeStorageKey(STORAGE_KEY, orgId)
}

function readUserStorage(): string | null {
  return readStorageKey(USER_STORAGE_KEY)
}

function writeUserStorage(userId: string | null): void {
  writeStorageKey(USER_STORAGE_KEY, userId)
}

function setModuleOrgId(orgId: string | null): void {
  if (activeOrgId === orgId) return
  activeOrgId = orgId
  emit()
}

/** Module ref for non-hook callers (e.g. call sites outside React). */
export function getActiveOrgId(): string | null {
  return activeOrgId
}

export function setActiveOrgId(orgId: string | null): void {
  activeOrgId = orgId
  writeStorage(orgId)
  emit()
}

export function initActiveOrgId(fallbackFromMe?: string | null): void {
  const stored = readStorage()
  if (stored) {
    activeOrgId = stored
  } else if (fallbackFromMe) {
    activeOrgId = fallbackFromMe
    writeStorage(fallbackFromMe)
  } else {
    activeOrgId = null
  }
  emit()
}

/**
 * Bind the persisted org to the signed-in user.
 * A leftover org from another account (or from before this user onboarded)
 * must not be sent as `x-org-id`. Signed-out keeps storage so the same user
 * can return to their last org.
 */
export function syncActiveOrgForSession(session: {
  userId: string | null
  onboarded: boolean
}): void {
  if (!session.userId) {
    setModuleOrgId(null)
    return
  }

  const storedUserId = readUserStorage()
  if (storedUserId !== null && storedUserId !== session.userId) {
    writeUserStorage(session.userId)
    setActiveOrgId(null)
    return
  }

  if (storedUserId === null) {
    writeUserStorage(session.userId)
  }

  if (!session.onboarded) {
    setActiveOrgId(null)
    return
  }

  const stored = readStorage()
  if (stored && activeOrgId !== stored) {
    activeOrgId = stored
    emit()
  }
}

/** Drop a stored org the current user is not an ACTIVE member of. */
export function reconcileActiveOrg(opts: {
  membershipOrgIds: string[]
  fallback?: string | null
}): void {
  const current = activeOrgId ?? readStorage()
  if (current && opts.membershipOrgIds.includes(current)) {
    if (activeOrgId !== current) {
      activeOrgId = current
      writeStorage(current)
      emit()
    }
    return
  }
  const fallback = opts.fallback
  const next = fallback && opts.membershipOrgIds.includes(fallback) ? fallback : null
  setActiveOrgId(next)
}

export function subscribeActiveOrg(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test seam — reset module state between cases. */
export function resetActiveOrgState(): void {
  activeOrgId = null
  listeners.clear()
}
