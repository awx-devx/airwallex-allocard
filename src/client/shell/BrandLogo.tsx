import Image from 'next/image'
import { BrandWordmark } from '@/client/shell/BrandWordmark'
import { publicAsset } from '@/lib/assets'
import { cn } from '@/lib/utils'

const SIZES = {
  default: {
    wrap: 'gap-2',
    mark: 'h-8 w-auto shrink-0 rounded-md',
    word: 'h-6 shrink-0',
  },
  lg: {
    wrap: '@container w-full gap-[0.167em] text-[min(6rem,calc(100cqw/5.4))]',
    mark: 'h-[1em] w-auto shrink-0 rounded-md',
    word: 'h-[0.75em] shrink-0',
  },
} as const

export function BrandLogo({
  className,
  priority = false,
  size = 'default',
}: {
  className?: string
  priority?: boolean
  size?: keyof typeof SIZES
}) {
  const scale = SIZES[size]
  return (
    <div
      role="img"
      aria-label="Allocard"
      className={cn('flex min-w-0 items-center', scale.wrap, className)}
    >
      <Image
        src={publicAsset.logomark}
        alt=""
        width={1268}
        height={950}
        className={scale.mark}
        unoptimized
        priority={priority}
      />
      <BrandWordmark className={cn(scale.word, 'group-data-[expanded=false]/sidenav:hidden')} />
    </div>
  )
}
