import { z } from 'zod'

const emptyToUndefined = (value: unknown) =>
  value === '' || value === undefined ? undefined : value

const serverEnvSchema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default('allocard'),
  REDIS_URL: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  AUTH_SECRET: z.string().min(1),
  AUTH_URL: z.string().url().default('http://localhost:3000'),

  AIRWALLEX_BASE_URL: z.string().url().default('https://api-demo.airwallex.com'),
  AIRWALLEX_CLIENT_ID: z.string().min(1),
  AIRWALLEX_API_KEY: z.string().min(1),
  AIRWALLEX_WEBHOOK_SECRET: z.string().min(1),
  AIRWALLEX_API_VERSION: z.string().min(1).default('2024-02-22'),
  AIRWALLEX_ACCOUNT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),

  REMOTE_AUTH_MODE: z.enum(['simulate', 'live']).default('simulate'),

  ROLE: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  ADMIN_JOB_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  WORKER_SCHEDULER_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
})

/** Client-safe env. No `NEXT_PUBLIC_*` vars in ARCHITECTURE §12 yet. */
const publicEnvSchema = z.object({})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type PublicEnv = z.infer<typeof publicEnvSchema>

function formatEnvError(error: z.ZodError): string {
  const names = [
    ...new Set(
      error.issues.map((issue) => {
        const key = issue.path[0]
        return typeof key === 'string' || typeof key === 'number' ? String(key) : 'unknown'
      }),
    ),
  ]
  return `Invalid environment: missing or invalid ${names.join(', ')}`
}

type EnvSource = Record<string, string | undefined>

/** Parse and validate server env. The only place that may read `process.env`. */
export function loadServerEnv(source: EnvSource = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(formatEnvError(result.error))
  }
  return result.data
}

export function loadPublicEnv(source: EnvSource = process.env): PublicEnv {
  const result = publicEnvSchema.safeParse(source)
  if (!result.success) {
    throw new Error(formatEnvError(result.error))
  }
  return result.data
}

/**
 * Parsed once at module load. Under Vitest, eager parse is skipped so unit
 * tests can call `loadServerEnv` with fixtures without requiring a real `.env`.
 */
export const serverEnv: ServerEnv =
  process.env.VITEST === 'true' ? (undefined as unknown as ServerEnv) : loadServerEnv()

export const publicEnv: PublicEnv =
  process.env.VITEST === 'true' ? (undefined as unknown as PublicEnv) : loadPublicEnv()
