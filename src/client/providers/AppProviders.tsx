'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ActiveOrgProvider } from '@/client/providers/ActiveOrgProvider'
import { ErrorBoundary } from '@/client/providers/ErrorBoundary'
import { createAppQueryClient } from '@/client/providers/queryClient'
import { SessionProvider } from '@/client/providers/SessionProvider'
import { ThemeProvider } from '@/client/providers/ThemeProvider'
import { ToastProvider } from '@/client/providers/ToastProvider'
import { TooltipProvider } from '@/components/ui/tooltip'

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => createAppQueryClient())

  return (
    <SessionProvider>
      <ThemeProvider>
        <TooltipProvider>
          <QueryClientProvider client={queryClient}>
            <ActiveOrgProvider>
              <ToastProvider>
                <ErrorBoundary>{children}</ErrorBoundary>
              </ToastProvider>
            </ActiveOrgProvider>
          </QueryClientProvider>
        </TooltipProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
