import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import {
  findCardholderById,
  listCardholders,
  type ListCardholdersFilter,
} from '@/server/repositories/cardholders'
import type { Cardholder, CardholderList } from '@/shared/types/cardholder'

export async function listCardholdersForOrg(
  ctx: OrgContext,
  filter: ListCardholdersFilter = {},
): Promise<CardholderList> {
  await connectDb()
  return listCardholders(ctx, filter)
}

export async function getCardholderForOrg(ctx: OrgContext, id: string): Promise<Cardholder> {
  await connectDb()
  const cardholder = await findCardholderById(ctx, id)
  if (!cardholder) {
    throw AppError.notFound()
  }
  return cardholder
}
