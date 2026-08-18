import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default:
          'border-border/80 bg-card/90 text-card-foreground shadow-[var(--shadow-elevated)] backdrop-blur-sm',
        destructive:
          'border-destructive/40 bg-destructive/10 text-destructive *:data-[slot=alert-description]:text-destructive/90 [&>svg]:text-current',
        info: 'border-status-info/45 bg-status-info/10 text-foreground [&>svg]:text-status-info',
        success:
          'border-status-success/45 bg-status-success/10 text-foreground [&>svg]:text-status-success',
        warning:
          'border-status-warning/45 bg-status-warning/10 text-foreground [&>svg]:text-status-warning',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const ALERT_ICONS: Record<
  NonNullable<VariantProps<typeof alertVariants>['variant']>,
  LucideIcon
> = {
  default: InfoIcon,
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  destructive: CircleAlertIcon,
}

function alertHasSvgChild(children: React.ReactNode): boolean {
  return React.Children.toArray(children).some((child) => {
    if (!React.isValidElement(child)) return false
    if (child.type === 'svg') return true
    const type = child.type
    if (typeof type === 'object' && type !== null && 'displayName' in type) {
      const name = String((type as { displayName?: string }).displayName ?? '')
      return name.endsWith('Icon') || name.startsWith('Lucide')
    }
    return false
  })
}

function Alert({
  className,
  variant = 'default',
  children,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  const Icon = ALERT_ICONS[variant ?? 'default']
  const inject = !alertHasSvgChild(children)
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {inject ? <Icon aria-hidden /> : null}
      {children}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-title"
      className={cn('col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed',
        className,
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
