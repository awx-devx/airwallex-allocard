import { loadServerEnv } from '@/server/env'
import { decideRemoteAuth } from '@/server/services/remoteAuth/decide'
import {
  REMOTE_AUTH_NONCE_HEADER,
  REMOTE_AUTH_SIGNATURE_HEADER,
  verifyRemoteAuthSignature,
} from '@/server/services/remoteAuth/verify'
import { remoteAuthInput } from '@/shared/schemas/remoteAuth'

/**
 * POST /api/remote-auth — Airwallex remote authorization.
 * Raw body + signature; one Redis GET; no DB. Hard ceiling 2.5s (Airwallex).
 */
export async function POST(req: Request): Promise<Response> {
  const raw = await req.text()
  const env = loadServerEnv()

  const verified = verifyRemoteAuthSignature({
    nonce: req.headers.get(REMOTE_AUTH_NONCE_HEADER),
    signature: req.headers.get(REMOTE_AUTH_SIGNATURE_HEADER),
    secret: env.AIRWALLEX_WEBHOOK_SECRET,
  })
  if (!verified.ok) {
    return new Response('invalid signature', { status: 400 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return new Response('invalid payload', { status: 400 })
  }

  const input = remoteAuthInput.safeParse(parsed)
  if (!input.success) {
    return new Response('invalid payload', { status: 400 })
  }

  const failMode = process.env.REMOTE_AUTH_FAIL_MODE === 'closed' ? 'closed' : 'open'
  const result = await decideRemoteAuth(input.data, { failMode })
  return Response.json(result.decision, { status: 200 })
}
