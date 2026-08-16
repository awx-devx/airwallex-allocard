'use client'

import Link from 'next/link'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function DeferredStep({
  title,
  phase,
  href,
  linkLabel,
}: {
  title: string
  phase: 'A3' | 'A6' | 'A7'
  href?: string
  linkLabel?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <Alert variant="info">
        <AlertTitle>
          {title} land in {phase}.
        </AlertTitle>
        <AlertDescription>Nothing is saved on this step.</AlertDescription>
      </Alert>
      {href && linkLabel ? (
        <Link href={href} className={cn(buttonVariants({ variant: 'outline' }), 'w-fit')}>
          {linkLabel}
        </Link>
      ) : null}
    </div>
  )
}
