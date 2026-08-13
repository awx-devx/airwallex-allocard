import { percentOf } from '@/lib/money'

export function limitMeterLayout({ amount, remaining }: { amount: number; remaining: number }): {
  used: number
  usedPct: number
  isOver: boolean
} {
  const used = amount - remaining
  const usedPct = percentOf(used, amount)
  const isOver = remaining < 0
  return { used, usedPct, isOver }
}

export function humaniseInterval(interval: string): string {
  return interval
    .split('_')
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(' ')
}
