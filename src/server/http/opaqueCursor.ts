/**
 * Opaque feed cursor: base64url JSON `{ at, id }`.
 * Shared by activity and audit list endpoints — never offset pages.
 */
import { AppError } from '@/server/http/errors'

export type OpaqueCursorPayload = { at: string; id: string }

export function encodeOpaqueCursor(at: string, id: string): string {
  return Buffer.from(JSON.stringify({ at, id } satisfies OpaqueCursorPayload), 'utf8').toString(
    'base64url',
  )
}

export function decodeOpaqueCursor(cursor: string): OpaqueCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as OpaqueCursorPayload).at !== 'string' ||
      typeof (parsed as OpaqueCursorPayload).id !== 'string'
    ) {
      throw new Error('invalid')
    }
    return parsed as OpaqueCursorPayload
  } catch {
    throw AppError.validationFailed({ cursor: ['Invalid cursor'] })
  }
}
