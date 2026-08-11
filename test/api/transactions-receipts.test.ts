/**
 * B8.8 — Receipt upload/delete + missing-receipt sweep.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as UPLOAD, DELETE as DELETE_RECEIPT } from '@/app/api/transactions/[id]/receipt/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ReceiptFileModel } from '@/server/models/ReceiptFile'
import { RoleModel } from '@/server/models/Role'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as transactionsRepo from '@/server/repositories/transactions'
import { sweepMissingReceipts } from '@/server/services/transactions/receipts'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { transactionContracts } from '@/shared/contracts/transaction'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

const SMALL_PDF_BASE64 = Buffer.from('fake-pdf-content').toString('base64')

describe('B8.8 receipts', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
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
      email: `rcpt-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Rcpt Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Rcpt Project',
      code: `RC-${Date.now().toString(16)}`,
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

  async function addOrgMember(orgId: string, name = 'Member') {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return {
      user,
      session: {
        userId: user.id,
        orgId,
        orgRole: OrgRole.MEMBER,
        onboarded: true as const,
      },
    }
  }

  async function seedTransaction(
    ctx: OrgContext,
    projectId: string,
    overrides: Partial<transactionsRepo.CreateTransactionInput> = {},
  ) {
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
      ...overrides,
    })
  }

  // ─── POST /api/transactions/:id/receipt ────────────────────────────────

  describe('POST /api/transactions/:id/receipt', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await UPLOAD(
        buildRequest({
          method: 'POST',
          path: '/api/transactions/x/receipt',
          session: null,
          params: { id: 'x' },
          body: {
            fileName: 'r.pdf',
            contentType: 'application/pdf',
            contentBase64: SMALL_PDF_BASE64,
          },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await UPLOAD(
        buildRequest({
          method: 'POST',
          path: '/api/transactions/x/receipt',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: {
            fileName: 'r.pdf',
            contentType: 'application/pdf',
            contentBase64: SMALL_PDF_BASE64,
          },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('returns 404 for cross-org transaction', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const tx = await seedTransaction(a.ctx, a.project.id)
      const res = await UPLOAD(
        buildRequest({
          method: 'POST',
          path: `/api/transactions/${tx.id}/receipt`,
          session: b.session,
          params: { id: tx.id },
          body: {
            fileName: 'r.pdf',
            contentType: 'application/pdf',
            contentBase64: SMALL_PDF_BASE64,
          },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      const res = await UPLOAD(
        buildRequest({
          method: 'POST',
          path: `/api/transactions/${tx.id}/receipt`,
          session: member.session,
          params: { id: tx.id },
          body: {
            fileName: 'r.pdf',
            contentType: 'application/pdf',
            contentBase64: SMALL_PDF_BASE64,
          },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    it('returns 422 on invalid payload', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const res = await UPLOAD(
        buildRequest({
          method: 'POST',
          path: `/api/transactions/${tx.id}/receipt`,
          session: owner.session,
          params: { id: tx.id },
          body: { fileName: '', contentType: 'text/plain', contentBase64: '' },
        }),
      )
      expect(res.status).toBe(422)
    })

    it('uploads receipt and writes audit', async () => {
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
      const body = await expectMatchesContract(res, transactionContracts.uploadReceipt.output)
      expect(body.receiptFileId).not.toBeNull()
      expect(body.id).toBe(tx.id)

      const file = await ReceiptFileModel.findOne({
        fileId: body.receiptFileId,
        orgId: owner.org.id,
      })
        .lean()
        .exec()
      expect(file).not.toBeNull()
      expect(file!.fileName).toBe('receipt.pdf')

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'transaction.receipt_uploaded',
        subjectId: tx.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('returns 404 when transaction is missing', async () => {
      const owner = await seedOwner()
      const res = await UPLOAD(
        buildRequest({
          method: 'POST',
          path: '/api/transactions/000000000000000000000000/receipt',
          session: owner.session,
          params: { id: '000000000000000000000000' },
          body: {
            fileName: 'r.pdf',
            contentType: 'application/pdf',
            contentBase64: SMALL_PDF_BASE64,
          },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── DELETE /api/transactions/:id/receipt ───────────────────────────────

  describe('DELETE /api/transactions/:id/receipt', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await DELETE_RECEIPT(
        buildRequest({
          method: 'DELETE',
          path: '/api/transactions/x/receipt',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await DELETE_RECEIPT(
        buildRequest({
          method: 'DELETE',
          path: '/api/transactions/x/receipt',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for cross-org transaction', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const tx = await seedTransaction(a.ctx, a.project.id)
      const res = await DELETE_RECEIPT(
        buildRequest({
          method: 'DELETE',
          path: `/api/transactions/${tx.id}/receipt`,
          session: b.session,
          params: { id: tx.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      const res = await DELETE_RECEIPT(
        buildRequest({
          method: 'DELETE',
          path: `/api/transactions/${tx.id}/receipt`,
          session: member.session,
          params: { id: tx.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('deletes receipt and writes audit', async () => {
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

      const updated = await transactionsRepo.findTransactionById(owner.ctx, tx.id)
      expect(updated!.receiptFileId).toBeNull()

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'transaction.receipt_deleted',
        subjectId: tx.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('returns 404 when transaction is missing', async () => {
      const owner = await seedOwner()
      const res = await DELETE_RECEIPT(
        buildRequest({
          method: 'DELETE',
          path: '/api/transactions/000000000000000000000000/receipt',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  // ─── Missing-receipt sweep ─────────────────────────────────────────────

  describe('sweepMissingReceipts', () => {
    it('flags CLEARED transactions above threshold missing receipt', async () => {
      const owner = await seedOwner()
      await seedTransaction(owner.ctx, owner.project.id, {
        status: TransactionStatus.CLEARED,
        amount: 10_000,
      })
      await seedTransaction(owner.ctx, owner.project.id, {
        status: TransactionStatus.CLEARED,
        amount: 3_000,
      })
      await seedTransaction(owner.ctx, owner.project.id, {
        status: TransactionStatus.AUTHORIZED,
        amount: 10_000,
      })

      const flagged = await sweepMissingReceipts(owner.ctx, 5_000)
      expect(flagged).toHaveLength(1)
    })

    it('does not flag transactions with a receipt', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id, {
        status: TransactionStatus.CLEARED,
        amount: 10_000,
      })
      await transactionsRepo.updateReceipt(owner.ctx, tx.id, { receiptFileId: 'file_123' })

      const flagged = await sweepMissingReceipts(owner.ctx, 5_000)
      expect(flagged).toHaveLength(0)
    })
  })
})
