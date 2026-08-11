/**
 * B8.10 — one audit assertion per mutating transaction path (receipt upload/delete).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as UPLOAD, DELETE as DELETE_RECEIPT } from '@/app/api/transactions/[id]/receipt/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { ReceiptFileModel } from '@/server/models/ReceiptFile'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as transactionsRepo from '@/server/repositories/transactions'
import { resetRedis } from '@/server/redis'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

const SMALL_PDF_BASE64 = Buffer.from('fake-pdf-content').toString('base64')

describe('audit/b8', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      TransactionModel.syncIndexes(),
      ReceiptFileModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `aud8-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Aud8 Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const project = await projectsRepo.createProject(ctx, {
      name: 'Aud8 Project',
      code: `A8-${Date.now().toString(16)}`,
    })
    return {
      user,
      org,
      ctx,
      project,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function seedTransaction(ctx: OrgContext, projectId: string) {
    return transactionsRepo.createTransaction(ctx, {
      cardId: 'card_001',
      projectId,
      airwallexTransactionId: `awx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      cardTransactionId: `ctx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      lifecycleId: `lc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: TransactionType.CLEARING,
      status: TransactionStatus.CLEARED,
      amount: 10_000,
      currency: 'USD',
      billingAmount: 10_000,
      billingCurrency: 'USD',
      merchant: { name: 'Test Merchant', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })
  }

  it('audits receipt upload (exactly one entry)', async () => {
    const owner = await seedOwner()
    const tx = await seedTransaction(owner.ctx, owner.project.id)

    const res = await UPLOAD(
      buildRequest({
        method: 'POST',
        path: `/api/transactions/${tx.id}/receipt`,
        session: owner.session,
        params: { id: tx.id },
        body: {
          fileName: 'receipt.pdf',
          contentType: 'application/pdf',
          contentBase64: SMALL_PDF_BASE64,
        },
      }),
    )
    expect(res.status).toBe(200)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'transaction.receipt_uploaded',
      subjectId: tx.id,
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]!.actorId).toBe(owner.user.id)
  })

  it('audits receipt delete (exactly one entry)', async () => {
    const owner = await seedOwner()
    const tx = await seedTransaction(owner.ctx, owner.project.id)

    await UPLOAD(
      buildRequest({
        method: 'POST',
        path: `/api/transactions/${tx.id}/receipt`,
        session: owner.session,
        params: { id: tx.id },
        body: {
          fileName: 'receipt.pdf',
          contentType: 'application/pdf',
          contentBase64: SMALL_PDF_BASE64,
        },
      }),
    )

    const res = await DELETE_RECEIPT(
      buildRequest({
        method: 'DELETE',
        path: `/api/transactions/${tx.id}/receipt`,
        session: owner.session,
        params: { id: tx.id },
      }),
    )
    expect(res.status).toBe(204)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'transaction.receipt_deleted',
      subjectId: tx.id,
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]!.actorId).toBe(owner.user.id)
  })
})
