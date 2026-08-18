import type { ReactNode } from 'react'
import { BrandLogo } from '@/client/shell/BrandLogo'

export function CenteredBrandFrame({
  children,
  priority = false,
  size = 'default',
}: {
  children: ReactNode
  priority?: boolean
  size?: 'default' | 'lg'
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex w-full max-w-md flex-col gap-6 px-4">
        <BrandLogo className="justify-center" priority={priority} size={size} />
        {children}
      </div>
    </div>
  )
}
