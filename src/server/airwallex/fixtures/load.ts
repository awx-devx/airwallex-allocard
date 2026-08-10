import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { AirwallexFixtureNotFoundError } from '@/server/airwallex/errors'

export type FixtureLookup = {
  method: string
  path: string
  requestId?: string
}

/**
 * Fixture file naming: `{METHOD}__{path-with-slashes-as-_}.json`
 * Optional request_id suffix: `...__req_{requestId}.json`
 * Example: `POST__api_v1_issuing_cards_create__req_allocard-card-abc.json`
 */
export function fixtureFileName(lookup: FixtureLookup): string {
  const normalized = lookup.path.replace(/^\//, '').replace(/\//g, '_')
  const base = `${lookup.method.toUpperCase()}__${normalized}`
  if (lookup.requestId) {
    return `${base}__req_${lookup.requestId}.json`
  }
  return `${base}.json`
}

const defaultFixturesDir = path.join(process.cwd(), 'src/server/airwallex/fixtures/recordings')

export type LoadFixtureOptions = {
  fixturesDir?: string
}

/** Load a recorded JSON body. Prefer request_id-specific file, then generic. */
export function loadFixture<T = unknown>(
  lookup: FixtureLookup,
  options: LoadFixtureOptions = {},
): T {
  const dir = options.fixturesDir ?? defaultFixturesDir
  const candidates: string[] = []
  if (lookup.requestId) {
    candidates.push(path.join(dir, fixtureFileName(lookup)))
  }
  candidates.push(path.join(dir, fixtureFileName({ method: lookup.method, path: lookup.path })))

  for (const file of candidates) {
    if (existsSync(file)) {
      const raw = readFileSync(file, 'utf8')
      return JSON.parse(raw) as T
    }
  }

  throw new AirwallexFixtureNotFoundError(lookup.method, lookup.path, lookup.requestId)
}

/** Test helper: resolve the recordings directory. */
export function fixturesDir(): string {
  return defaultFixturesDir
}
