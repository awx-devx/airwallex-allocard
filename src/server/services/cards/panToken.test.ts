import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { AirwallexError } from '@/server/airwallex/errors'
import type { AirwallexClient } from '@/server/airwallex/client'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { resetRedis } from '@/server/redis'
import { createCard } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import { createOrganization } from '@/server/repositories/organizations'
import { createProject } from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { createPanTokenForCard } from '@/server/services/cards/panToken'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'

function controls(): CardControls {
  return {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [],
  }
}

describe('services/cards/panToken', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
  })

  async function seedCard() {
    const user = await users.createUser({
      email: `pan-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Reveal User',
    })
    const org = await createOrganization({
      name: 'Reveal Org',
      slug: `reveal-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    const project = await createProject(ctx, {
      name: 'Reveal',
      code: `R-${Date.now().toString(16).slice(-6)}`,
    })
    const cardholder = await createCardholder(ctx, {
      userId: user.id,
      airwallexCardholderId: '555b9d6b-0966-4190-9864-fc75ff4e0eb6',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'a59390b7-2ebb-45f1-89a6-7a5ae1816ebf',
      maskedNumber: '************4242',
      nickName: 'reveal',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    return { ctx, card }
  }

  it('maps Airwallex access_denied to UPSTREAM_ERROR without auditing', async () => {
    const { ctx, card } = await seedCard()
    const aw = {
      panTokens: {
        create: vi.fn().mockRejectedValue(
          new AirwallexError({
            status: 403,
            code: 'access_denied',
            message: 'Access is denied to this resource',
          }),
        ),
      },
    } as unknown as AirwallexClient

    const err = await createPanTokenForCard(ctx, card.id, { airwallex: aw }).catch(
      (caught: unknown) => caught,
    )
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).code).toBe(ErrorCode.UPSTREAM_ERROR)
    expect((err as AppError).message).toBe('Access is denied to this resource')

    expect(aw.panTokens.create).toHaveBeenCalledWith({ card_id: card.airwallexCardId })
    const audits = await AuditLogModel.find({
      orgId: ctx.orgId,
      action: 'card.pan_token_created',
      subjectId: card.id,
    }).exec()
    expect(audits).toHaveLength(0)
  })
})
