/**
 * B5 phase-exit matrix gaps:
 * - #2 ONBOARDING_INCOMPLETE on representative card endpoints
 * - #1/#3/#4/#5 on lifecycle + limits/pan where previously missing
 * - #5 CARD scope deny for pan-token (viewDetails held, wrong cardIds)
 * - #9 request_id retry covered in airwallex/issuing.test.ts
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as GET_CARD } from '@/app/api/cards/[id]/route'
import { POST as CLOSE } from '@/app/api/cards/[id]/close/route'
import { POST as FREEZE } from '@/app/api/cards/[id]/freeze/route'
import { GET as LIMITS } from '@/app/api/cards/[id]/limits/route'
import { POST as PAN } from '@/app/api/cards/[id]/pan-token/route'
import { POST as RECONCILE } from '@/app/api/cards/[id]/reconcile/route'
import { GET as GET_ORG_CARDS } from '@/app/api/cards/route'
import { GET as GET_PROJECT_CARDS, POST as CREATE_CARD } from '@/app/api/projects/[id]/cards/route'
import { GET as LIST_CARDHOLDERS, POST as CREATE_CARDHOLDER } from '@/app/api/cardholders/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as cardholdersRepo from '@/server/repositories/cardholders'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { createCardForProject } from '@/server/services/cards/create'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { makeCardControls } from '../helpers/factories'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B5 matrix gaps', () => {
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

  async function incompleteSession() {
    const user = await users.createUser({
      email: `pre-b5-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Pre-onboard',
    })
    return {
      userId: user.id,
      orgId: null,
      orgRole: null,
      onboarded: false as const,
    }
  }

  async function expectOnboardingIncomplete(res: Response) {
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  }

  async function seedOwnerCard() {
    const user = await users.createUser({
      email: `mx-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Matrix Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Matrix',
      code: `MX-${Date.now().toString(16)}`,
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
      cardholder,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  describe('matrix #2 — onboarding incomplete', () => {
    it('GET /api/cards', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await GET_ORG_CARDS(buildRequest({ method: 'GET', path: '/api/cards', session })),
      )
    })

    it('GET /api/cardholders', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await LIST_CARDHOLDERS(buildRequest({ method: 'GET', path: '/api/cardholders', session })),
      )
    })

    it('POST /api/projects/:id/cards', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await CREATE_CARD(
          buildRequest({
            method: 'POST',
            path: '/api/projects/proj_x/cards',
            session,
            params: { id: 'proj_x' },
            body: {
              purpose: CardPurpose.SHARED,
              cardholderId: 'ch_x',
              desiredControls: makeCardControls(),
            },
          }),
        ),
      )
    })

    it('POST /api/cards/:id/freeze', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await FREEZE(
          buildRequest({
            method: 'POST',
            path: '/api/cards/card_x/freeze',
            session,
            params: { id: 'card_x' },
          }),
        ),
      )
    })

    it('GET /api/cards/:id/limits', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await LIMITS(
          buildRequest({
            method: 'GET',
            path: '/api/cards/card_x/limits',
            session,
            params: { id: 'card_x' },
          }),
        ),
      )
    })

    it('POST /api/cards/:id/pan-token', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await PAN(
          buildRequest({
            method: 'POST',
            path: '/api/cards/card_x/pan-token',
            session,
            params: { id: 'card_x' },
          }),
        ),
      )
    })

    it('POST /api/cards/:id/reconcile', async () => {
      const session = await incompleteSession()
      await expectOnboardingIncomplete(
        await RECONCILE(
          buildRequest({
            method: 'POST',
            path: '/api/cards/card_x/reconcile',
            session,
            params: { id: 'card_x' },
          }),
        ),
      )
    })
  })

  describe('matrix #1 / #3 / #4 — lifecycle + cards', () => {
    it('freeze returns 401 when unauthenticated', async () => {
      const res = await FREEZE(
        buildRequest({
          method: 'POST',
          path: '/api/cards/card_x/freeze',
          session: null,
          params: { id: 'card_x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('freeze returns 404 cross-org', async () => {
      const a = await seedOwnerCard()
      const b = await seedOwnerCard()
      const res = await FREEZE(
        buildRequest({
          method: 'POST',
          path: `/api/cards/${a.card.id}/freeze`,
          session: b.session,
          params: { id: a.card.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('POST create returns 403 when MEMBER lacks card.create', async () => {
      const setup = await seedOwnerCard()
      const member = await users.createUser({
        email: `nocreate-${Date.now()}@example.com`,
        name: 'No Create',
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

      const res = await CREATE_CARD(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${setup.project.id}/cards`,
          session: {
            userId: member.id,
            orgId: setup.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: setup.project.id },
          body: {
            purpose: CardPurpose.SHARED,
            cardholderId: setup.cardholder.id,
            desiredControls: makeCardControls(),
          },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
      void Permission.CARD_CREATE
    })

    it('close returns 404 cross-org', async () => {
      const a = await seedOwnerCard()
      const b = await seedOwnerCard()
      const res = await CLOSE(
        buildRequest({
          method: 'POST',
          path: `/api/cards/${a.card.id}/close`,
          session: b.session,
          params: { id: a.card.id },
          body: { confirm: true },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('GET project cards returns 401 when unauthenticated', async () => {
      const res = await GET_PROJECT_CARDS(
        buildRequest({
          method: 'GET',
          path: '/api/projects/p/cards',
          session: null,
          params: { id: 'p' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('POST cardholder returns 401 when unauthenticated', async () => {
      const res = await CREATE_CARDHOLDER(
        buildRequest({
          method: 'POST',
          path: '/api/cardholders',
          session: null,
          body: { type: CardholderType.DELEGATE },
        }),
      )
      expect(res.status).toBe(401)
    })
  })

  describe('matrix #5 — access scope excludes subject', () => {
    it('pan-token returns 403 when CARD scope excludes the card', async () => {
      const setup = await seedOwnerCard()
      const member = await users.createUser({
        email: `scoped-${Date.now()}@example.com`,
        name: 'Scoped',
      })
      await memberships.createMembership(
        { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )
      const spender = await rolesRepo.findRoleByKey(setup.ctx, 'project_spender')
      expect(spender).not.toBeNull()
      expect(spender!.permissions).toContain(Permission.CARD_VIEW_DETAILS)

      await projectMembers.addProjectMember(setup.ctx, {
        projectId: setup.project.id,
        userId: member.id,
        roleId: spender!.id,
        scope: {
          level: AccessScopeLevel.CARD,
          cardIds: ['card_other_not_this_one'],
        },
        effectivePermissions: spender!.permissions,
        addedBy: setup.user.id,
      })

      const res = await PAN(
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
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    it('GET card returns 403 when CARD scope excludes the card', async () => {
      const setup = await seedOwnerCard()
      const member = await users.createUser({
        email: `scoped-get-${Date.now()}@example.com`,
        name: 'Scoped Get',
      })
      await memberships.createMembership(
        { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )
      const spender = await rolesRepo.findRoleByKey(setup.ctx, 'project_spender')
      expect(spender).not.toBeNull()

      await projectMembers.addProjectMember(setup.ctx, {
        projectId: setup.project.id,
        userId: member.id,
        roleId: spender!.id,
        scope: {
          level: AccessScopeLevel.CARD,
          cardIds: ['card_other_not_this_one'],
        },
        effectivePermissions: spender!.permissions,
        addedBy: setup.user.id,
      })

      const res = await GET_CARD(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${setup.card.id}`,
          session: {
            userId: member.id,
            orgId: setup.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: setup.card.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    it('freeze returns 403 when CARD scope excludes the card', async () => {
      const setup = await seedOwnerCard()
      const member = await users.createUser({
        email: `scoped-fz-${Date.now()}@example.com`,
        name: 'Scoped Freeze',
      })
      await memberships.createMembership(
        { orgId: setup.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )
      const lead = await rolesRepo.findRoleByKey(setup.ctx, 'procurement_lead')
      expect(lead).not.toBeNull()
      expect(lead!.permissions).toContain(Permission.CARD_MANAGE)

      await projectMembers.addProjectMember(setup.ctx, {
        projectId: setup.project.id,
        userId: member.id,
        roleId: lead!.id,
        scope: {
          level: AccessScopeLevel.CARD,
          cardIds: ['card_other_not_this_one'],
        },
        effectivePermissions: lead!.permissions,
        addedBy: setup.user.id,
      })

      const res = await FREEZE(
        buildRequest({
          method: 'POST',
          path: `/api/cards/${setup.card.id}/freeze`,
          session: {
            userId: member.id,
            orgId: setup.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: setup.card.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })
  })

  describe('matrix #1 / #3 — limits + pan', () => {
    it('limits returns 401 when unauthenticated', async () => {
      const res = await LIMITS(
        buildRequest({
          method: 'GET',
          path: '/api/cards/x/limits',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('limits returns 404 cross-org', async () => {
      const a = await seedOwnerCard()
      const b = await seedOwnerCard()
      const res = await LIMITS(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${a.card.id}/limits`,
          session: b.session,
          params: { id: a.card.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('pan-token returns 404 cross-org', async () => {
      const a = await seedOwnerCard()
      const b = await seedOwnerCard()
      const res = await PAN(
        buildRequest({
          method: 'POST',
          path: `/api/cards/${a.card.id}/pan-token`,
          session: b.session,
          params: { id: a.card.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })
})
