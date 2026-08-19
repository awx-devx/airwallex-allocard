'use client'

import { useId, type ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const FILTER_ALL = '__all__'

/** Labeled filters + unlabeled buttons share a baseline (controls, not labels). */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 shrink-0 flex-wrap items-end gap-2', className)}>
      {children}
    </div>
  )
}

export function FilterSelect({
  label,
  value,
  onValueChange,
  children,
  allLabel,
  allValue = FILTER_ALL,
  placeholder,
  className,
}: {
  label: string
  value: string | undefined
  onValueChange: (value: string) => void
  children: ReactNode
  allLabel?: string
  allValue?: string
  placeholder?: string
  className?: string
}) {
  const id = useId()
  const shownPlaceholder = placeholder ?? allLabel ?? `All ${label.toLowerCase()}`

  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} aria-label={label} className="min-w-40">
          <SelectValue placeholder={shownPlaceholder} />
        </SelectTrigger>
        <SelectContent>
          {allLabel ? <SelectItem value={allValue}>{allLabel}</SelectItem> : null}
          {children}
        </SelectContent>
      </Select>
    </div>
  )
}
