/**
 * Worker entrypoint (ARCHITECTURE §8 / §9).
 *
 * Refuses to start unless `ROLE=worker`, so a misconfigured web replica can
 * never run jobs. On SIGTERM: stop accepting, finish in-flight work, release
 * locks, then exit.
 */
import { handleDomainEventForRules } from '@/server/events/handlers/rules'
import { DomainEventType } from '@/server/events/types'
import { EVENTS_STREAM, getEventStream, type EventStream } from '@/server/events/stream'
import { sweepScheduledRules } from '@/server/services/rules/sweep'
import { createDebouncer } from '@/worker/debounce'
import { createConsumers, createDebouncedDispatcher } from '@/worker/consumers'
import { createScheduler } from '@/worker/scheduler'

export type WorkerRuntime = {
  stop: () => Promise<void>
}

export type StartWorkerOptions = {
  role?: string | undefined
  /** Override for tests — skip the ROLE gate. */
  allowWithoutRole?: boolean
  evaluate?: (event: unknown) => Promise<void>
  /** Test seam — shorter debounce so SIGTERM drain is observable. */
  debounceWindowMs?: number
  /** Test seam — inject the event stream used by consumers. */
  stream?: EventStream
  /** Test seam — replace the rules sweep body. */
  sweepRules?: () => Promise<void>
}

function requireWorkerRole(role: string | undefined, allowWithoutRole?: boolean): void {
  if (allowWithoutRole) {
    return
  }
  if (role !== 'worker') {
    throw new Error(
      `Worker refused to start: ROLE must be "worker" (got ${role === undefined ? 'unset' : JSON.stringify(role)})`,
    )
  }
}

/** Job stubs for phases that own these bodies. Sweeps must stay near-idle when healthy. */
async function noopJob(name: string): Promise<void> {
  console.info(`[worker] job ${name} (noop)`)
}

export async function startWorker(options: StartWorkerOptions = {}): Promise<WorkerRuntime> {
  const role = options.role ?? process.env.ROLE
  requireWorkerRole(role, options.allowWithoutRole)

  let stopping = false
  const debouncer = createDebouncer({ windowMs: options.debounceWindowMs ?? 1000 })
  const evaluate =
    options.evaluate ??
    (async (event) => {
      await handleDomainEventForRules(event as Parameters<typeof handleDomainEventForRules>[0])
    })

  const dispatcher = createDebouncedDispatcher(debouncer, evaluate)
  const consumers = createConsumers(dispatcher, {
    ...(options.stream ? { stream: options.stream } : {}),
    blockMs: 500,
    shouldStop: () => stopping,
  })

  const eventsConsumer = consumers.startEvents()
  const webhooksConsumer = consumers.startWebhooks()

  const scheduler = createScheduler()
  const runSweep = options.sweepRules ?? (() => sweepScheduledRules().then(() => undefined))
  scheduler.schedule({
    name: 'sweep-rules',
    everyMs: 5 * 60_000,
    run: runSweep,
  })
  scheduler.schedule({
    name: 'reconcile-drift',
    everyMs: 15 * 60_000,
    run: () => noopJob('reconcile-drift'),
  })
  scheduler.schedule({
    name: 'refresh-attributes',
    everyMs: 60_000,
    run: () => noopJob('refresh-attributes'),
  })
  scheduler.schedule({
    name: 'escalate-approvals',
    everyMs: 10 * 60_000,
    run: () => noopJob('escalate-approvals'),
  })
  scheduler.schedule({
    name: 'expire-access',
    everyMs: 60 * 60_000,
    run: () => noopJob('expire-access'),
  })
  scheduler.schedule({
    name: 'sync-transactions',
    everyMs: 30 * 60_000,
    run: () => noopJob('sync-transactions'),
  })

  console.info('[worker] started')

  async function stop(): Promise<void> {
    if (stopping) {
      return
    }
    stopping = true
    console.info('[worker] SIGTERM — draining')
    eventsConsumer.stop()
    webhooksConsumer.stop()
    scheduler.stopAccepting()
    debouncer.stopAccepting()
    await debouncer.flush()
    await scheduler.waitForIdle()
    // Unblock any XREADGROUP waiters by publishing a wake event.
    await (options.stream ?? getEventStream()).publish(EVENTS_STREAM, {
      type: DomainEventType.ATTRIBUTE_UPDATED,
      orgId: '_shutdown',
      subjectType: 'system',
      subjectId: 'shutdown',
      payload: {},
      emittedAt: new Date(),
    })
    await Promise.race([
      Promise.all([eventsConsumer.done, webhooksConsumer.done]),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ])
    console.info('[worker] stopped')
  }

  return { stop }
}

/** CLI entry when run as `tsx src/worker/index.ts`. */
export async function main(): Promise<void> {
  const runtime = await startWorker()

  const onSignal = () => {
    void runtime.stop().then(() => {
      process.exit(0)
    })
  }
  process.on('SIGTERM', onSignal)
  process.on('SIGINT', onSignal)

  await new Promise(() => {})
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('/src/worker/index.ts') ||
    process.argv[1].endsWith('/worker/index.ts') ||
    process.argv[1].endsWith('\\src\\worker\\index.ts'))

if (isDirectRun) {
  void main().catch((error) => {
    console.error('[worker] fatal', error)
    process.exit(1)
  })
}
