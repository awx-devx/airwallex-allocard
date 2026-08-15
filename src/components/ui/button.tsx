import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

/** Icon-only (`size="icon"`) callers must pass `aria-label` when children are not a string. */

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[var(--shadow-gloss-primary)] hover:brightness-110 active:brightness-95',
        destructive:
          'bg-destructive text-destructive-foreground shadow-[inset_0_1px_0_0_hsl(var(--gloss-highlight)/0.22)] hover:brightness-110 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-border/90 bg-card/80 shadow-[var(--shadow-elevated)] backdrop-blur-sm hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-card/60',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[inset_0_1px_0_0_hsl(var(--gloss-highlight)/0.55)] hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild && !loading ? Slot.Root : 'button'
  const classNameMerged = cn(buttonVariants({ variant, size }), className)

  // Slot.Root requires exactly one element child. A `null` spinner sibling
  // throws "Slot failed to slot onto its children" (Create/Resume asChild Links).
  if (asChild && !loading) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={classNameMerged}
        disabled={disabled}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={classNameMerged}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
