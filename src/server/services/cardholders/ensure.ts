/**
 * Ensure an INDIVIDUAL cardholder exists for a user (idempotent on orgId+userId).
 * Created at member-add time so screening can complete before card issue.
 * Never fails the caller on PENDING screening or transient Airwallex errors —
 * persists a local PENDING mirror and returns it.
 */
import { randomUUID } from 'node:crypto'
import { connectDb } from '@/server/db/connect'
import { getAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import { cardholderRequestId, isIssuableCardholderId } from '@/server/airwallex/types'
import { loadServerEnv } from '@/server/env'
import type { OrgContext } from '@/server/http/types'
import {
  createCardholder,
  findCardholderByAirwallexId,
  findCardholderByUserId,
  findOrgDelegateCardholder,
  updateCardholderAirwallexId,
  updateCardholderStatus,
} from '@/server/repositories/cardholders'
import { findOrganizationById } from '@/server/repositories/organizations'
import { findUserById } from '@/server/repositories/users'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import type { Cardholder } from '@/shared/types/cardholder'

export type EnsureCardholderDeps = {
  airwallex?: AirwallexClient
  useFixtures?: boolean
}

function resolveUseFixtures(deps: EnsureCardholderDeps): boolean {
  return deps.useFixtures ?? loadServerEnv().AIRWALLEX_USE_FIXTURES
}

/**
 * Sandbox placeholder KYC. API `2024-02-22` requires email, mobile_number,
 * top-level address, and `individual` on every cardholder create — including
 * DELEGATE. This sandbox also returns `400 mobile_number is mandatory` without
 * a number. 555 is reserved.
 */
export const SANDBOX_CARDHOLDER_MOBILE = '14155550100'
export const SANDBOX_CARDHOLDER_DOB = '1990-01-01'
export const SANDBOX_CARDHOLDER_ADDRESS = {
  line1: '1 Market Street',
  city: 'San Francisco',
  state: 'CA',
  postcode: '94105',
  country: 'US',
}

/** Unique per org — Airwallex emails must be unique on the account. */
export function delegateCardholderEmail(orgId: string): string {
  return `allocard-delegate-${orgId}@example.com`
}

function sandboxIndividual(name: { first_name: string; last_name: string }) {
  return {
    name,
    date_of_birth: SANDBOX_CARDHOLDER_DOB,
    address: { ...SANDBOX_CARDHOLDER_ADDRESS },
    express_consent_obtained: 'yes' as const,
  }
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

function isProvisionalAirwallexId(id: string): boolean {
  return id.startsWith('pending:')
}

function warnCardholder(action: string, error: unknown, extra: Record<string, string>): void {
  const message = error instanceof Error ? error.message : 'unknown error'
  console.warn('[cardholders]', action, { ...extra, message })
}

async function submitIndividualCreate(
  ctx: OrgContext,
  cardholder: Cardholder,
  userId: string,
  deps: EnsureCardholderDeps,
): Promise<Cardholder> {
  const user = await findUserById(userId)
  const email = user?.email ?? `${userId}@example.com`
  const name = splitName(user?.name ?? 'Cardholder User')
  const client = deps.airwallex ?? getAirwallexClient()

  try {
    const aw = await client.cardholders.create({
      request_id: cardholderRequestId(cardholder.id),
      type: 'INDIVIDUAL',
      email,
      mobile_number: SANDBOX_CARDHOLDER_MOBILE,
      address: { ...SANDBOX_CARDHOLDER_ADDRESS },
      individual: sandboxIndividual(name),
      metadata: { orgId: ctx.orgId, cardDocId: cardholder.id },
    })

    let awId = aw.cardholder_id
    const clash = await findCardholderByAirwallexId(ctx, awId)
    if (clash && clash.id !== cardholder.id) {
      awId = `${aw.cardholder_id}:${cardholder.id}`
    }

    const withAwId = await updateCardholderAirwallexId(ctx, cardholder.id, awId)
    const withStatus = await updateCardholderStatus(ctx, cardholder.id, mapAwStatus(aw.status))
    return withStatus ?? withAwId ?? cardholder
  } catch (error) {
    warnCardholder('create', error, { cardholderId: cardholder.id, userId })
    return (await findCardholderByUserId(ctx, userId)) ?? cardholder
  }
}

async function submitDelegateCreate(
  ctx: OrgContext,
  cardholder: Cardholder,
  deps: EnsureCardholderDeps,
): Promise<Cardholder> {
  const client = deps.airwallex ?? getAirwallexClient()
  const org = await findOrganizationById(ctx.orgId)
  const name = splitName(org?.name ?? 'Allocard Delegate')
  try {
    const aw = await client.cardholders.create({
      request_id: cardholderRequestId(cardholder.id),
      type: 'DELEGATE',
      email: delegateCardholderEmail(ctx.orgId),
      mobile_number: SANDBOX_CARDHOLDER_MOBILE,
      address: { ...SANDBOX_CARDHOLDER_ADDRESS },
      individual: sandboxIndividual(name),
      metadata: { orgId: ctx.orgId, cardDocId: cardholder.id },
    })

    let awId = aw.cardholder_id
    const clash = await findCardholderByAirwallexId(ctx, awId)
    if (clash && clash.id !== cardholder.id) {
      awId = `${aw.cardholder_id}:${cardholder.id}`
    }

    const withAwId = await updateCardholderAirwallexId(ctx, cardholder.id, awId)
    const withStatus = await updateCardholderStatus(ctx, cardholder.id, mapAwStatus(aw.status))
    return withStatus ?? withAwId ?? cardholder
  } catch (error) {
    warnCardholder('create', error, { cardholderId: cardholder.id, type: 'DELEGATE' })
    return (await findOrgDelegateCardholder(ctx)) ?? cardholder
  }
}

/** Refresh a PENDING/INCOMPLETE cardholder from Airwallex (retry create or GET). */
export async function refreshCardholder(
  ctx: OrgContext,
  cardholder: Cardholder,
  deps: EnsureCardholderDeps = {},
): Promise<Cardholder> {
  if (
    isProvisionalAirwallexId(cardholder.airwallexCardholderId) ||
    !isIssuableCardholderId(cardholder.airwallexCardholderId, resolveUseFixtures(deps))
  ) {
    if (cardholder.type === CardholderType.DELEGATE) {
      return submitDelegateCreate(ctx, cardholder, deps)
    }
    if (!cardholder.userId) {
      return cardholder
    }
    return submitIndividualCreate(ctx, cardholder, cardholder.userId, deps)
  }

  if (cardholder.status === CardholderStatus.READY) {
    return cardholder
  }

  const client = deps.airwallex ?? getAirwallexClient()
  try {
    const aw = await client.cardholders.get(cardholder.airwallexCardholderId)
    const status = mapAwStatus(aw.status)
    if (status === cardholder.status) {
      return cardholder
    }
    return (await updateCardholderStatus(ctx, cardholder.id, status)) ?? cardholder
  } catch (error) {
    warnCardholder('get', error, {
      cardholderId: cardholder.id,
      airwallexCardholderId: cardholder.airwallexCardholderId,
    })
    return cardholder
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
    if (!isIssuableCardholderId(existing.airwallexCardholderId, resolveUseFixtures(deps))) {
      if (isProvisionalAirwallexId(existing.airwallexCardholderId) || existing.userId) {
        return refreshCardholder(ctx, existing, deps)
      }
      return existing
    }
    if (existing.status === CardholderStatus.READY) {
      return existing
    }
    return refreshCardholder(ctx, existing, deps)
  }

  const provisionalId = `pending:${randomUUID()}`
  const cardholder = await createCardholder(ctx, {
    userId,
    airwallexCardholderId: provisionalId,
    type: CardholderType.INDIVIDUAL,
    status: CardholderStatus.PENDING,
  })

  return submitIndividualCreate(ctx, cardholder, userId, deps)
}

/**
 * One DELEGATE cardholder per Allocard org (idempotent). Demo cards are all
 * issued `issue_to: ORGANISATION`; Airwallex never sees an employee cardholder.
 */
export async function ensureOrgDelegateCardholder(
  ctx: OrgContext,
  deps: EnsureCardholderDeps = {},
): Promise<Cardholder> {
  await connectDb()

  const existing = await findOrgDelegateCardholder(ctx)
  if (existing) {
    if (!isIssuableCardholderId(existing.airwallexCardholderId, resolveUseFixtures(deps))) {
      return refreshCardholder(ctx, existing, deps)
    }
    if (existing.status === CardholderStatus.READY) {
      return existing
    }
    return refreshCardholder(ctx, existing, deps)
  }

  const provisionalId = `pending:${randomUUID()}`
  const cardholder = await createCardholder(ctx, {
    userId: null,
    airwallexCardholderId: provisionalId,
    type: CardholderType.DELEGATE,
    status: CardholderStatus.PENDING,
  })

  return submitDelegateCreate(ctx, cardholder, deps)
}
