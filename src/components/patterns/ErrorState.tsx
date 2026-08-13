import type { ErrorStateProps } from '@/components/patterns/types'
import { Button } from '@/components/ui/button'
import { ErrorCode } from '@/shared/enums/errors'

const RETRYABLE: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.RATE_LIMITED,
  ErrorCode.UPSTREAM_ERROR,
  ErrorCode.INTERNAL,
])

export function shouldShowErrorRetry(code: ErrorCode | undefined, hasRetry: boolean): boolean {
  if (!hasRetry) return false
  if (code === undefined) return true
  return RETRYABLE.has(code)
}

export function ErrorState({ message, onRetry, code }: ErrorStateProps) {
  const showRetry = shouldShowErrorRetry(code, typeof onRetry === 'function')
  return (
    <div role="alert" className="space-y-3 rounded-md border border-border p-4">
      <p className="text-sm">{message}</p>
      {showRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  )
}
