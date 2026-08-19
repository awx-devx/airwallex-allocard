import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-md border-0 bg-card/70 px-3 py-2 text-base shadow-[var(--shadow-inset-field),0_0_0_1px_hsl(var(--border)/0.7)] transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:shadow-[var(--shadow-inset-field),0_0_0_1px_hsl(var(--laser)/0.4)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/40 dark:aria-invalid:ring-destructive/40',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
