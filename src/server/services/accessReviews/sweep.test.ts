import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import type { OrgContext } from '@/server/http/types'
import { AccessReviewModel } from '@/server/models/AccessReview'
import { AuditLogModel } from '@/server/models/AuditLog'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RuleRunModel } from '@/server/models/RuleRun'
import { RoleModel } from '@/server/models/Role'
import * as accessReviews from '@/server/repositories/accessReviews'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projects from '@/server/repositories/projects'
import * as roles from '@/server/repositories/roles'
import * as ruleRuns from '@/server/repositories/ruleRuns'
import * as users from '@/server/repositories/users'
import {
  INACTIVE_MEMBER_DAYS,
  REASON_MEMBER_INACTIVE,
  REASON_SCOPE_EXPIRED,
  sweepAccessReviews,
} from '@/server/services/accessReviews/sweep'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AccessReviewStatus } from '@/shared/enums/accessReviewStatus'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { ActorType } from '@/shared/enums/audit'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'

function ctx(orgId: string, userId = 'user_owner'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('accessReviews/sweep', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      ProjectModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      RoleModel.syncIndexes(),
      AccessReviewModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
    ])
  })

  beforeEach(async () => {
    // ensure clean between tests handled by useTestDb
  })

  async function seedOrgWithMember(opts: { slug: string; validTo?: string; updatedAt?: Date }) {
    const owner = await users.createUser({
      email: `owner-${opts.slug}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: `Org ${opts.slug}`,
      slug: opts.slug,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: owner.id,
    })
    const orgCtx = ctx(org.id, owner.id)
    const project = await projects.createProject(orgCtx, {
      name: 'APAC',
      code: `SWP-${opts.slug}`,
    })
    const role = await roles.createRole(orgCtx, {
      key: `viewer-${opts.slug}`,
      name: 'Viewer',
      permissions: [Permission.PROJECT_VIEW],
    })
    const assignee = await users.createUser({
      email: `member-${opts.slug}@example.com`,
      name: 'Member',
    })
    const member = await projectMembers.addProjectMember(orgCtx, {
      projectId: project.id,
      userId: assignee.id,
      roleId: role.id,
      scope: {
        level: AccessScopeLevel.PROJECT,
        ...(opts.validTo ? { validTo: opts.validTo } : {}),
      },
      effectivePermissions: [Permission.PROJECT_VIEW],
      addedBy: owner.id,
    })

    if (opts.updatedAt) {
      await ProjectMemberModel.updateOne(
        { _id: member.id, orgId: org.id },
        { $set: { updatedAt: opts.updatedAt } },
        { timestamps: false },
      )
    }

    return { orgCtx, org, project, member, assignee }
  }

  it('creates OPEN review for scopes past validTo (idempotent)', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
    const { orgCtx, member } = await seedOrgWithMember({
      slug: `exp-${Date.now().toString(16)}`,
      validTo: past,
    })

    const first = await sweepAccessReviews(new Date())
    expect(first.created).toBeGreaterThanOrEqual(1)

    const open = await accessReviews.listAccessReviews(orgCtx, {
      status: AccessReviewStatus.OPEN,
    })
    const forMember = open.filter(
      (r) => r.subjectId === member.id && r.reason === REASON_SCOPE_EXPIRED,
    )
    expect(forMember).toHaveLength(1)

    const second = await sweepAccessReviews(new Date())
    expect(second.created).toBe(0)
    expect(
      (await accessReviews.listAccessReviews(orgCtx, { status: AccessReviewStatus.OPEN })).filter(
        (r) => r.subjectId === member.id && r.reason === REASON_SCOPE_EXPIRED,
      ),
    ).toHaveLength(1)
  })

  it(`creates OPEN review for members inactive ${INACTIVE_MEMBER_DAYS} days`, async () => {
    const stale = new Date(Date.now() - (INACTIVE_MEMBER_DAYS + 1) * 24 * 60 * 60_000)
    const { orgCtx, member } = await seedOrgWithMember({
      slug: `inact-${Date.now().toString(16)}`,
      updatedAt: stale,
    })

    const result = await sweepAccessReviews(new Date())
    expect(result.created).toBeGreaterThanOrEqual(1)

    const open = await accessReviews.listAccessReviews(orgCtx, {
      status: AccessReviewStatus.OPEN,
    })
    expect(open.some((r) => r.subjectId === member.id && r.reason === REASON_MEMBER_INACTIVE)).toBe(
      true,
    )
  })

  it('creates OPEN review from WOULD_APPLY flag.review rule actions', async () => {
    const { orgCtx, org, project, member, assignee } = await seedOrgWithMember({
      slug: `flag-${Date.now().toString(16)}`,
    })

    await ruleRuns.createRuleRun(orgCtx, {
      ruleId: '000000000000000000000001',
      triggeredBy: 'system',
      triggeredByType: ActorType.SYSTEM,
      triggerEvent: 'member.role_changed',
      inputs: [
        {
          key: 'member.status',
          subjectType: AttributeSubjectType.MEMBER,
          subjectId: assignee.id,
          value: 'ACTIVE',
          observedAt: new Date().toISOString(),
          ttlSec: null,
          stale: false,
        },
      ],
      matched: true,
      desiredState: { cards: [] },
      diff: { cards: [] },
      actions: [
        {
          action: RuleActionType.FLAG_REVIEW,
          targetId: assignee.id,
          status: ActionResultStatus.WOULD_APPLY,
          message: null,
          details: { reason: 'role change', targetKind: 'member' },
        },
      ],
      conflicts: [],
      status: RuleRunStatus.SUCCESS,
      durationMs: 1,
      startedAt: new Date(),
      finishedAt: new Date(),
      projectId: project.id,
    })

    const first = await sweepAccessReviews(new Date())
    expect(first.created).toBeGreaterThanOrEqual(1)

    const open = await accessReviews.listAccessReviews(orgCtx, {
      status: AccessReviewStatus.OPEN,
    })
    expect(open.some((r) => r.subjectId === member.id && r.reason === 'role change')).toBe(true)

    const second = await sweepAccessReviews(new Date())
    expect(
      (await accessReviews.listAccessReviews(orgCtx, { status: AccessReviewStatus.OPEN })).filter(
        (r) => r.subjectId === member.id && r.reason === 'role change',
      ),
    ).toHaveLength(1)
    // May create 0 new for this subject/reason; other fixtures from parallel suites N/A
    void org
    void second
  })

  it('does not flag fresh members without expired scope', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString()
    const { orgCtx, member } = await seedOrgWithMember({
      slug: `fresh-${Date.now().toString(16)}`,
      validTo: future,
    })

    await sweepAccessReviews(new Date())
    const open = await accessReviews.listAccessReviews(orgCtx, {
      status: AccessReviewStatus.OPEN,
    })
    expect(open.some((r) => r.subjectId === member.id)).toBe(false)
  })
})
