import type { ReactNode } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** Opaque paper for page and wizard forms — fields sit on a card, not the canvas. */
export function FormPanel({
  children,
  footer,
  className,
}: {
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardContent className="flex min-w-0 flex-col gap-4">{children}</CardContent>
      {footer ? <CardFooter className="flex flex-wrap gap-2 border-t">{footer}</CardFooter> : null}
    </Card>
  )
}
