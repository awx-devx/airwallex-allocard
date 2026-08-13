'use client'

import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="flex gap-2" role="group" aria-label="Theme">
      {THEMES.map((item) => (
        <Button
          key={item.value}
          type="button"
          size="sm"
          variant={theme === item.value ? 'default' : 'outline'}
          onClick={() => setTheme(item.value)}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}
