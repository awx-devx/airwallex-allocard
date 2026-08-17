'use client'

import { useSyncExternalStore } from 'react'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const THEMES = [
  { value: 'light', label: 'Light', icon: SunIcon },
  { value: 'system', label: 'System', icon: MonitorIcon },
  { value: 'dark', label: 'Dark', icon: MoonIcon },
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
    <div
      className="inline-flex w-fit items-center rounded-lg bg-muted p-[3px] text-muted-foreground"
      role="radiogroup"
      aria-label="Theme"
    >
      {THEMES.map((item) => {
        const Icon = item.icon
        const isSelected = selected === item.value
        return (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant="ghost"
            role="radio"
            aria-checked={isSelected}
            aria-label={item.label}
            className={cn(
              'size-7 px-0 text-foreground/60 hover:text-foreground',
              isSelected && 'bg-background text-foreground shadow-sm hover:bg-background',
            )}
            onClick={() => setTheme(item.value)}
          >
            <Icon />
          </Button>
        )
      })}
    </div>
  )
}
