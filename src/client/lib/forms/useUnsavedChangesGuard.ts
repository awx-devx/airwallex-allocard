'use client'

/**
 * Browser-tab unsaved-changes guard via `beforeunload`.
 * Next.js App Router in-app navigation blocking is out of scope until A2 wizard.
 */
import { useEffect } from 'react'

/** Pure handler — test without React. */
export function syncBeforeUnload(isDirty: boolean, event: BeforeUnloadEvent): string | undefined {
  if (!isDirty) {
    return undefined
  }
  event.preventDefault()
  event.returnValue = ''
  return ''
}

export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) {
      return undefined
    }
    const handler = (event: BeforeUnloadEvent) => {
      syncBeforeUnload(true, event)
    }
    window.addEventListener('beforeunload', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
    }
  }, [isDirty])
}
