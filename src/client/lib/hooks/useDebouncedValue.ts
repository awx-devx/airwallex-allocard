'use client'

import { useEffect, useState } from 'react'

/** Pure debounce — test without React. */
export function debounceValue<T>(
  value: T,
  delayMs: number,
  nowMs: number,
  scheduledAtMs: number,
): {
  value: T
  nextScheduledAtMs: number
  shouldSchedule: boolean
} {
  if (delayMs <= 0) {
    return { value, nextScheduledAtMs: nowMs, shouldSchedule: false }
  }
  if (nowMs - scheduledAtMs >= delayMs) {
    return { value, nextScheduledAtMs: nowMs, shouldSchedule: false }
  }
  return { value, nextScheduledAtMs: scheduledAtMs, shouldSchedule: true }
}

const DEFAULT_DELAY_MS = 300

export function useDebouncedValue<T>(value: T, delayMs = DEFAULT_DELAY_MS): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [value, delayMs])

  return debounced
}
