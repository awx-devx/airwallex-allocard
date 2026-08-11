'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorBoundary } from '@/client/providers/ErrorBoundary'
import { createAppQueryClient } from '@/client/providers/queryClient'
import { SessionProvider } from '@/client/providers/SessionProvider'
import { ToastProvider } from '@/client/providers/ToastProvider'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient())

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </SessionProvider>
  )
}
