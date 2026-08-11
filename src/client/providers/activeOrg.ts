const STORAGE_KEY = 'allocard:activeOrgId'

let activeOrgId: string | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) {
    listener()
  }
}

function readStorage(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function writeStorage(orgId: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (orgId === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, orgId)
    }
  } catch {
    // ignore quota / private mode
  }
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

export function subscribeActiveOrg(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
