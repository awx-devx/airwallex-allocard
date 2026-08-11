'use client'

import { useSyncExternalStore } from 'react'
import { toastStore } from '@/client/providers/toastStore'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useSyncExternalStore(toastStore.subscribe, toastStore.getSnapshot, () => [])

  return (
    <>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 9999,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            data-kind={toast.kind}
            style={{
              background: '#111',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: 4,
              maxWidth: 360,
            }}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => toastStore.dismiss(toast.id)}
              style={{ marginLeft: 12 }}
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>
    </>
  )
}
