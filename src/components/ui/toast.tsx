import type { ToastKind } from '@/client/providers/toastStore'
import { cn } from '@/lib/utils'

const kindClass: Record<ToastKind, string> = {
  success: 'bg-status-success text-status-success-foreground',
  error: 'bg-status-danger text-status-danger-foreground',
  info: 'bg-status-info text-status-info-foreground',
}

export type ToastProps = {
  kind: ToastKind
  message: string
  onDismiss: () => void
}

function Toast({ kind, message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      data-kind={kind}
      className={cn(
        'flex max-w-sm items-start gap-3 rounded-md px-3 py-2 text-sm',
        kindClass[kind],
      )}
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="shrink-0 text-current opacity-80 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  )
}

export { Toast }
