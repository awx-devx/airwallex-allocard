/**
 * Scheduled sweeps — the backstop (ARCHITECTURE §8).
 * Each tick takes `lock:job:{name}` so extra replicas don't double-run.
 */
import { getRedis, redisKeys } from '@/server/redis'

export type ScheduledJob = {
  name: string
  everyMs: number
  run: () => Promise<void>
}

export type SchedulerOptions = {
  /** Job lock TTL. Default 60s. */
  lockPx?: number
  schedule?: (fn: () => void, ms: number) => { clear: () => void }
}

function defaultSchedule(fn: () => void, ms: number): { clear: () => void } {
  const handle = setTimeout(fn, ms)
  return { clear: () => clearTimeout(handle) }
}

export function createScheduler(options: SchedulerOptions = {}) {
  const lockPx = options.lockPx ?? 60_000
  const schedule = options.schedule ?? defaultSchedule
  const timers = new Map<string, { clear: () => void }>()
  let stopped = false
  let inflight = 0

  async function tick(job: ScheduledJob): Promise<void> {
    if (stopped) {
      return
    }
    const acquired = await getRedis().set(redisKeys.lockJob(job.name), '1', {
      nx: true,
      px: lockPx,
    })
    if (!acquired) {
      return
    }
    inflight += 1
    try {
      await job.run()
    } finally {
      inflight -= 1
      await getRedis().del(redisKeys.lockJob(job.name))
    }
  }

  return {
    schedule(job: ScheduledJob): void {
      const loop = () => {
        if (stopped) {
          return
        }
        void tick(job).finally(() => {
          if (!stopped) {
            timers.set(
              job.name,
              schedule(() => {
                loop()
              }, job.everyMs),
            )
          }
        })
      }
      // First run after everyMs — don't stampede on boot.
      timers.set(
        job.name,
        schedule(() => {
          loop()
        }, job.everyMs),
      )
    },

    stopAccepting(): void {
      stopped = true
      for (const timer of timers.values()) {
        timer.clear()
      }
      timers.clear()
    },

    inflightCount(): number {
      return inflight
    },

    async waitForIdle(): Promise<void> {
      while (inflight > 0) {
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
    },

    /** Test helper — run one named job immediately under the lock. */
    async runOnce(job: ScheduledJob): Promise<boolean> {
      const acquired = await getRedis().set(redisKeys.lockJob(job.name), '1', {
        nx: true,
        px: lockPx,
      })
      if (!acquired) {
        return false
      }
      inflight += 1
      try {
        await job.run()
        return true
      } finally {
        inflight -= 1
        await getRedis().del(redisKeys.lockJob(job.name))
      }
    },
  }
}

export type Scheduler = ReturnType<typeof createScheduler>
