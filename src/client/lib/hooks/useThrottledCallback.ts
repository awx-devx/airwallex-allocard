'use client'

import { useCallback, useEffect, useRef } from 'react'

/** Leading-edge throttle — test via createThrottledInvoker. */
export function createThrottledInvoker<A extends unknown[]>(
  fn: (...args: A) => void,
  intervalMs: number,
  now: () => number = Date.now,
) {
  let lastInvokedAt = Number.NEGATIVE_INFINITY
  return (...args: A) => {
    const t = now()
    if (t - lastInvokedAt >= intervalMs) {
      lastInvokedAt = t
      fn(...args)
    }
  }
}

export function useThrottledCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  intervalMs: number,
): (...args: A) => void {
  const fnRef = useRef(fn)
  useEffect(() => {
    fnRef.current = fn
  })
  const lastInvokedAtRef = useRef(Number.NEGATIVE_INFINITY)

  return useCallback(
    (...args: A) => {
      const now = Date.now()
      if (now - lastInvokedAtRef.current >= intervalMs) {
        lastInvokedAtRef.current = now
        fnRef.current(...args)
      }
    },
    [intervalMs],
  )
}
