import { toastStore } from '@/client/providers/toastStore'

async function fallbackCopy(text: string): Promise<boolean> {
  if (typeof document === 'undefined') {
    return false
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  textarea.remove()
  return ok
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      toastStore.success('Copied')
      return true
    }
    const ok = await fallbackCopy(text)
    if (ok) {
      toastStore.success('Copied')
      return true
    }
    toastStore.error('Copy failed')
    return false
  } catch {
    toastStore.error('Copy failed')
    return false
  }
}
