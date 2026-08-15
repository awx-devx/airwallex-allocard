'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

function subscribe() {
  return () => undefined
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const selected = mounted ? theme : undefined

  return (
    <div className="flex gap-2" role="group" aria-label="Theme">
      {THEMES.map((item) => (
        <Button
          key={item.value}
          type="button"
          size="sm"
          variant={selected === item.value ? 'default' : 'outline'}
          onClick={() => setTheme(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}
