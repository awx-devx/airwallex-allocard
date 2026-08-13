import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** The only spinner. Use this — do not add another. */
function Spinner({
  className,
  'aria-label': ariaLabel = 'Loading',
  ...props
}: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label={ariaLabel}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
