import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/client/api/errors'

function shouldRetry(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && error.status >= 500 && failureCount < 2
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: shouldRetry,
      },
    },
  })
}

/** Exported for unit tests — mirrors the QueryClient retry predicate. */
export { shouldRetry as queryRetryPredicate }
