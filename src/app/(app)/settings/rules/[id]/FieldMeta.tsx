'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDownIcon, ChevronRightIcon, InfoIcon } from 'lucide-react'
import { insertAttributeHint, insertAttributePlaceholder } from '@/client/lib/rules'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function InfoTip({
  children,
  label = 'More information',
}: {
  children: ReactNode
  label?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 shrink-0 items-center justify-center text-muted-foreground"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
        >
          <InfoIcon className="size-4 shrink-0" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  )
}

export function FieldLabel({
  htmlFor,
  hint,
  children,
}: {
  htmlFor?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1">
      <Label htmlFor={htmlFor}>{children}</Label>
      {hint ? <InfoTip>{hint}</InfoTip> : null}
    </div>
  )
}

export function FormSection({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0 rounded-md border border-border p-4', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <h2 className="text-sm font-medium">{title}</h2>
        {hint ? <InfoTip>{hint}</InfoTip> : null}
      </div>
      <div className="mt-3 flex min-w-0 flex-col gap-3">{children}</div>
    </section>
  )
}

export function OptionalBlock({
  summary,
  hint,
  children,
  defaultOpen = false,
  className,
}: {
  summary: string
  hint?: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details className={cn('min-w-0', className)} open={open}>
      <summary
        className="flex cursor-pointer list-none flex-wrap items-center gap-1 text-sm font-medium [&::-webkit-details-marker]:hidden"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault()
          setOpen((current) => !current)
        }}
      >
        {open ? (
          <ChevronDownIcon className="size-4 shrink-0" aria-hidden />
        ) : (
          <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
        )}
        {summary}
        {hint ? <InfoTip>{hint}</InfoTip> : null}
      </summary>
      <div className="mt-2 flex min-w-0 flex-col gap-3">{children}</div>
    </details>
  )
}

export function AttributeInsertPicker({
  options,
  onInsert,
}: {
  options: ComboboxOption[]
  onInsert: (key: string) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-1">
        <Combobox
          options={options}
          value={null}
          onChange={(key) => {
            if (key !== null) onInsert(key)
          }}
          placeholder={insertAttributePlaceholder()}
        />
      </div>
      <InfoTip>{insertAttributeHint()}</InfoTip>
    </div>
  )
}
