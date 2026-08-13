'use client'

import { useSyncExternalStore } from 'react'
import { toastStore } from '@/client/providers/toastStore'
import { Toast } from '@/components/ui/toast'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => [])

  return (
    <>
      {children}
      <div
        aria-live="polite"
        role="status"
        className="fixed right-4 bottom-4 z-[var(--z-toast)] flex flex-col gap-2"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            kind={toast.kind}
            message={toast.message}
            onDismiss={() => toastStore.dismiss(toast.id)}
          />
        ))}
      </div>
    </>
  )
}
