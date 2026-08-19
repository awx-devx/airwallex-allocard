import { Skeleton } from '@/components/ui/skeleton'

export function LoadingState({ label = 'Loading', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label={label}
      className={rows >= 3 ? 'min-h-[120px] space-y-2' : 'space-y-2'}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={i === rows - 1 ? 'h-4 w-3/5' : 'h-4 w-full'} />
      ))}
    </div>
  )
}
