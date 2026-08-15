export type ToastKind = 'success' | 'error' | 'info'

export type Toast = {
  id: string
  kind: ToastKind
  message: string
}

type Listener = (toasts: Toast[]) => void

const EMPTY_TOASTS: Toast[] = []

let toasts: Toast[] = EMPTY_TOASTS
const listeners = new Set<Listener>()
let nextId = 1

function emit(): void {
  for (const listener of listeners) {
    listener(toasts)
  }
}

function push(kind: ToastKind, message: string): void {
  toasts = [...toasts, { id: String(nextId++), kind, message }]
  emit()
}

export const toastStore = {
  success(message: string): void {
    push('success', message)
  },
  error(message: string): void {
    push('error', message)
  },
  info(message: string): void {
    push('info', message)
  },
  dismiss(id: string): void {
    toasts = toasts.filter((t) => t.id !== id)
    emit()
  },
  clear(): void {
    toasts = EMPTY_TOASTS
    emit()
  },
  getSnapshot(): Toast[] {
    return toasts
  },
  getServerSnapshot(): Toast[] {
    return EMPTY_TOASTS
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}
