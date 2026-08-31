import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/cards/[id]/limits/route'
import { POST as PAN } from '@/app/api/cards/[id]/pan-token/route'
import { POST as RECONCILE } from '@/app/api/cards/[id]/reconcile/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import * as cardholdersRepo from '@/server/repositories/cardholders'
import * as rolesRepo from '@/server/repositories/roles'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { createCardForProject } from '@/server/services/cards/create'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { updateDesiredControls } from '@/server/repositories/cards'
import { cardContracts } from '@/shared/contracts/card'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { makeCardControls } from '../helpers/factories'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'
import * as projectMembers from '@/server/repositories/projectMembers'

describe('/api/cards/:id limits + pan-token + reconcile', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedOwnerCard() {
    const user = await users.createUser({
      email: `lim-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Limits Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Limits',
      code: `LM-${Date.now().toString(16)}`,
    })
    const ch = await createCardholderForOrg(ctx, { type: CardholderType.DELEGATE })
    if (ch.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, ch.id, CardholderStatus.READY)
    }
    const cardholder = (await cardholdersRepo.findCardholderById(ctx, ch.id))!
    const card = await createCardForProject(ctx, project.id, {
      purpose: CardPurpose.SHARED,
      cardholderId: cardholder.id,
      desiredControls: makeCardControls(),
      accessList: [user.id],
    })
    return {
      user,
      org,
      project,
      card,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('returns live limits in minor units', async () => {
    const setup = await seedOwnerCard()
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: `/api/cards/${setup.card.id}/limits`,
        session: setup.session,
        params: { id: setup.card.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardContracts.limits.output)
    expect(body.currency).toBe('USD')
    expect(body.limits[0]?.amount).toBe(400_000)
    expect(body.limits[0]?.remaining).toBe(350_000)
  })

  it('creates a pan token with audit; denies without viewDetails', async () => {
    const setup = await seedOwnerCard()

    const okRes = await PAN(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/pan-token`,
        session: setup.session,
        params: { id: setup.card.id },
      }),
    )
    expect(okRes.status).toBe(200)
    const token = await expectMatchesContract(okRes, cardContracts.panToken.output)
    expect(token.kind).toBe('iframe')
    if (token.kind === 'iframe') {
      expect(token.token).toBeTruthy()
    }
    expect(token).not.toHaveProperty('number')
    expect(token).not.toHaveProperty('card_number')

    const audits = await AuditLogModel.find({
      orgId: setup.org.id,
      action: 'card.pan_token_created',
      subjectId: setup.card.id,
    }).exec()
    expect(audits).toHaveLength(1)

    const member = await users.createUser({
      email: `noview-${Date.now()}@example.com`,
      name: 'No Details',
    })
    await memberships.createMembership(
      { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )
    const viewer = await rolesRepo.findRoleByKey(setup.ctx, 'viewer')
    expect(viewer).not.toBeNull()
    await projectMembers.addProjectMember(setup.ctx, {
      projectId: setup.project.id,
      userId: member.id,
      roleId: viewer!.id,
      scope: { level: AccessScopeLevel.PROJECT },
      effectivePermissions: viewer!.permissions,
      addedBy: setup.user.id,
    })

    const denied = await PAN(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/pan-token`,
        session: {
          userId: member.id,
          orgId: setup.org.id,
          orgRole: OrgRole.MEMBER,
          onboarded: true,
        },
        params: { id: setup.card.id },
      }),
    )
    expect(denied.status).toBe(403)
    expect((await readBody<{ error: { code: string } }>(denied)).error.code).toBe(
      ErrorCode.PERMISSION_DENIED,
    )
  })

  it('reconcile pushes desired controls', async () => {
    const setup = await seedOwnerCard()
    await updateDesiredControls(setup.ctx, setup.card.id, {
      ...makeCardControls(),
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 50_000 }],
      },
    })

    const res = await RECONCILE(
      buildRequest({
        method: 'POST',
        path: `/api/cards/${setup.card.id}/reconcile`,
        session: setup.session,
        params: { id: setup.card.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardContracts.reconcile.output)
    expect(body.appliedControls.transactionLimits.limits[0]?.amount).toBe(50_000)
  })
})
