import { CircleAlertIcon, RefreshCwIcon } from 'lucide-react'
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
      <div className="flex items-start gap-2">
        <CircleAlertIcon className="size-4 shrink-0" aria-hidden />
        <p className="text-sm">{message}</p>
      </div>
      {showRetry ? (
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCwIcon className="size-4 shrink-0" aria-hidden />
          Retry
        </Button>
      ) : null}
    </div>
  )
}
