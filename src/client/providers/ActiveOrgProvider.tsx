'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import {
  getActiveOrgId,
  initActiveOrgId,
  setActiveOrgId,
  subscribeActiveOrg,
} from '@/client/providers/activeOrg'

type ActiveOrgContextValue = {
  orgId: string | null
  setOrgId: (id: string | null) => void
}

const ActiveOrgContext = createContext<ActiveOrgContextValue | null>(null)

export function ActiveOrgProvider({
  children,
  initialOrgId = null,
}: {
  children: ReactNode
  /** From meResponse.activeOrg.id when available. */
  initialOrgId?: string | null
}) {
  useEffect(() => {
    initActiveOrgId(initialOrgId)
  }, [initialOrgId])

  const orgId = useSyncExternalStore(subscribeActiveOrg, getActiveOrgId, () => null)
  const setOrgId = useCallback((id: string | null) => {
    setActiveOrgId(id)
  }, [])

  const value = useMemo(() => ({ orgId, setOrgId }), [orgId, setOrgId])

  return <ActiveOrgContext.Provider value={value}>{children}</ActiveOrgContext.Provider>
}

export function useActiveOrg(): ActiveOrgContextValue {
  const ctx = useContext(ActiveOrgContext)
  if (!ctx) {
    throw new Error('useActiveOrg must be used within ActiveOrgProvider')
  }
  return ctx
}
