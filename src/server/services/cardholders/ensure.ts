/**
 * Ensure an INDIVIDUAL cardholder exists for a user (idempotent on orgId+userId).
 * Created at member-add time so screening can complete before card issue.
 * Never fails the caller on PENDING screening or transient Airwallex errors —
 * persists a local PENDING mirror and returns it.
 */
import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { cardholderRequestId } from '@/server/airwallex/types'
import type { OrgContext } from '@/server/http/types'
import {
  createCardholder,
  findCardholderByAirwallexId,
  findCardholderByUserId,
  updateCardholderAirwallexId,
  updateCardholderStatus,
} from '@/server/repositories/cardholders'
import { findUserById } from '@/server/repositories/users'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import type { Cardholder } from '@/shared/types/cardholder'

export type EnsureCardholderDeps = {
  airwallex?: AirwallexClient
}

function splitName(name: string): { first_name: string; last_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return { first_name: 'Cardholder', last_name: 'User' }
  }
  if (parts.length === 1) {
    return { first_name: parts[0]!, last_name: 'User' }
  }
  return { first_name: parts[0]!, last_name: parts.slice(1).join(' ') }
}

function mapAwStatus(status: string): CardholderStatus {
  switch (status) {
    case 'READY':
      return CardholderStatus.READY
    case 'INCOMPLETE':
      return CardholderStatus.INCOMPLETE
    case 'DISABLED':
      return CardholderStatus.DISABLED
    case 'DELETED':
      return CardholderStatus.DELETED
    case 'PENDING':
    default:
      return CardholderStatus.PENDING
  }
}

export async function ensureIndividualCardholder(
  ctx: OrgContext,
  userId: string,
  deps: EnsureCardholderDeps = {},
): Promise<Cardholder> {
  await connectDb()

  const existing = await findCardholderByUserId(ctx, userId)
  if (existing) {
    return existing
  }

  const user = await findUserById(userId)
  const email = user?.email ?? `${userId}@example.com`
  const name = splitName(user?.name ?? 'Cardholder User')

  // Provisional unique id until Airwallex returns the real one.
  const provisionalId = `pending:${randomUUID()}`
  let cardholder = await createCardholder(ctx, {
    userId,
    airwallexCardholderId: provisionalId,
    type: CardholderType.INDIVIDUAL,
    status: CardholderStatus.PENDING,
  })

  const client = deps.airwallex ?? getAirwallexClient()
  try {
    const aw = await client.cardholders.create({
      request_id: cardholderRequestId(cardholder.id),
      type: 'INDIVIDUAL',
      email,
      individual: {
        name,
        // Sandbox placeholder KYC — real identity collection is out of B5 scope.
        date_of_birth: '1990-01-01',
        address: {
          line1: '1 Market Street',
          city: 'San Francisco',
          state: 'CA',
          postcode: '94105',
          country: 'US',
        },
        express_consent_obtained: 'yes',
      },
      metadata: { orgId: ctx.orgId, cardDocId: cardholder.id },
    })

    // Fixture mode returns a static cardholder_id; uniquify on collision within the org.
    let awId = aw.cardholder_id
    const clash = await findCardholderByAirwallexId(ctx, awId)
    if (clash && clash.id !== cardholder.id) {
      awId = `${aw.cardholder_id}:${cardholder.id}`
    }

    const withAwId = await updateCardholderAirwallexId(ctx, cardholder.id, awId)
    const withStatus = await updateCardholderStatus(ctx, cardholder.id, mapAwStatus(aw.status))
    cardholder = withStatus ?? withAwId ?? cardholder
  } catch {
    // Keep local PENDING mirror — member-add must not fail on screening delay / AW errors.
  }

  return (await findCardholderByUserId(ctx, userId)) ?? cardholder
}
