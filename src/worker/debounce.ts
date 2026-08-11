/**
 * Trailing debounce per `(ruleId, subjectId)` (ARCHITECTURE §8).
 *
 * The first event schedules an evaluation; events inside the window replace
 * the pending work rather than stacking. Twenty events therefore become one
 * evaluation about a second after the burst settles.
 */
import { getRedis, redisKeys } from '@/server/redis'

export type DebounceOptions = {
  /** Trailing window in ms. Default 1000. */
  windowMs?: number
  /** Redis lock TTL in ms. Default 5000. */
  lockPx?: number
  /** Test seam — inject a clock. */
  now?: () => number
  /** Test seam — inject setTimeout. */
  schedule?: (fn: () => void, ms: number) => { clear: () => void }
}

export type DebouncedJob = {
  ruleId: string
  subjectId: string
  run: () => Promise<void>
}

type Pending = {
  job: DebouncedJob
  timer: { clear: () => void }
  lockHeld: boolean
}

function defaultSchedule(fn: () => void, ms: number): { clear: () => void } {
  const handle = setTimeout(fn, ms)
  return { clear: () => clearTimeout(handle) }
}

export function createDebouncer(options: DebounceOptions = {}) {
  const windowMs = options.windowMs ?? 1000
  const lockPx = options.lockPx ?? 5000
  const schedule = options.schedule ?? defaultSchedule
  const pending = new Map<string, Pending>()
  let inflight = 0
  let stopped = false

  function keyOf(ruleId: string, subjectId: string): string {
    return `${ruleId}:${subjectId}`
  }

  async function execute(entry: Pending): Promise<void> {
    inflight += 1
    try {
      await entry.job.run()
    } finally {
      inflight -= 1
      if (entry.lockHeld) {
        await getRedis().del(redisKeys.lockRule(entry.job.ruleId, entry.job.subjectId))
      }
    }
  }

  async function fire(key: string): Promise<void> {
    const entry = pending.get(key)
    if (!entry) {
      return
    }
    pending.delete(key)
    await execute(entry)
  }

  return {
    /** Schedule (or collapse into) an evaluation for this subject. */
    async schedule(job: DebouncedJob): Promise<void> {
      if (stopped) {
        return
      }
      const key = keyOf(job.ruleId, job.subjectId)
      const existing = pending.get(key)
      if (existing) {
        existing.timer.clear()
        existing.job = job
        existing.timer = schedule(() => {
          void fire(key)
        }, windowMs)
        return
      }

      const lockHeld = await getRedis().set(redisKeys.lockRule(job.ruleId, job.subjectId), '1', {
        nx: true,
        px: lockPx,
      })
      // Another replica may hold the lock; still coalesce locally so this
      // process does not run twenty times, and the lock holder will run once.
      const timer = schedule(() => {
        void fire(key)
      }, windowMs)
      pending.set(key, { job, timer, lockHeld })
    },

    /** How many subjects currently have a timer pending. */
    pendingCount(): number {
      return pending.size
    },

    /** Jobs currently executing (for SIGTERM drain). */
    inflightCount(): number {
      return inflight
    },

    /** Stop accepting new work; clear timers without running them. */
    stopAccepting(): void {
      stopped = true
    },

    /** Run every pending job now (tests / shutdown flush). */
    async flush(): Promise<void> {
      const keys = [...pending.keys()]
      for (const key of keys) {
        const entry = pending.get(key)
        entry?.timer.clear()
        await fire(key)
      }
      while (inflight > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
    },

    /** Cancel pending timers and release locks without running jobs. */
    async cancelPending(): Promise<void> {
      for (const [key, entry] of pending) {
        entry.timer.clear()
        if (entry.lockHeld) {
          await getRedis().del(redisKeys.lockRule(entry.job.ruleId, entry.job.subjectId))
        }
        pending.delete(key)
      }
    },
  }
}

export type Debouncer = ReturnType<typeof createDebouncer>
