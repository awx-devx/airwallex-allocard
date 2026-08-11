/**
 * B9.7 — settleClosure: DONE when no pending auths; BLOCKED with count otherwise.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrgContext } from '@/server/http/types'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectClosureModel } from '@/server/models/ProjectClosure'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import { upsertStart } from '@/server/repositories/projectClosures'
import { createTransaction } from '@/server/repositories/transactions'
import { settleClosure } from '@/server/services/closure/settle'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { useTestDb } from '../../../../test/helpers/db'

describe('closure/settle', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      TransactionModel.syncIndexes(),
      ProjectClosureModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  async function seedClosingProject() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `se-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Settle Org',
      slug: `se-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Settle Project',
      code: `SE-${Date.now().toString(16)}`,
    })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date(),
      launchedAt: new Date(),
    })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.ACTIVE, ProjectStatus.CLOSING)

    const now = new Date()
    const steps = (Object.values(ClosureStep) as ClosureStep[]).map((step) => {
      if (step === ClosureStep.PREFLIGHT || step === ClosureStep.FREEZE) {
        return {
          step,
          status: ClosureStepStatus.DONE,
          startedAt: now,
          completedAt: now,
          detail: null,
        }
      }
      return {
        step,
        status: ClosureStepStatus.PENDING,
        startedAt: null,
        completedAt: null,
        detail: null,
      }
    })
    await upsertStart(ctx, {
      projectId: project.id,
      startedBy: user.id,
      currentStep: ClosureStep.SETTLE,
      steps,
      startedAt: now,
    })

    return {
      ctx,
      project: (await projectsRepo.findProjectById(ctx, project.id))!,
    }
  }

  it('marks SETTLE DONE and advances to REVOKE when no pending auths', async () => {
    const { ctx, project } = await seedClosingProject()
    const closure = await settleClosure(ctx, project.id)
    const settle = closure.steps.find((s) => s.step === ClosureStep.SETTLE)
    expect(settle?.status).toBe(ClosureStepStatus.DONE)
    expect(settle?.detail).toBeNull()
    expect(closure.currentStep).toBe(ClosureStep.REVOKE)
  })

  it('marks SETTLE BLOCKED with pending count when AUTHORIZED auth remains', async () => {
    const { ctx, project } = await seedClosingProject()
    await createTransaction(ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: project.id,
      airwallexTransactionId: `awx-s1-${Date.now()}`,
      cardTransactionId: `ct-s1-${Date.now()}`,
      lifecycleId: `life-s1-${Date.now()}`,
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 100,
      currency: 'USD',
      billingAmount: 100,
      billingCurrency: 'USD',
      merchant: { name: 'A', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })
    await createTransaction(ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: project.id,
      airwallexTransactionId: `awx-s2-${Date.now()}`,
      cardTransactionId: `ct-s2-${Date.now()}`,
      lifecycleId: `life-s2-${Date.now()}`,
      type: TransactionType.INCREMENTAL_AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 50,
      currency: 'USD',
      billingAmount: 50,
      billingCurrency: 'USD',
      merchant: { name: 'B', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    const closure = await settleClosure(ctx, project.id)
    const settle = closure.steps.find((s) => s.step === ClosureStep.SETTLE)
    expect(settle?.status).toBe(ClosureStepStatus.BLOCKED)
    expect(settle?.detail).toBe('2 pending authorization(s)')
    expect(closure.currentStep).toBe(ClosureStep.SETTLE)
  })

  it('ignores non-auth AUTHORIZED txs (e.g. CLEARING) for the pending count', async () => {
    const { ctx, project } = await seedClosingProject()
    await createTransaction(ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: project.id,
      airwallexTransactionId: `awx-clr-${Date.now()}`,
      cardTransactionId: `ct-clr-${Date.now()}`,
      lifecycleId: `life-clr-${Date.now()}`,
      type: TransactionType.CLEARING,
      status: TransactionStatus.AUTHORIZED,
      amount: 100,
      currency: 'USD',
      billingAmount: 100,
      billingCurrency: 'USD',
      merchant: { name: 'C', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    const closure = await settleClosure(ctx, project.id)
    expect(closure.steps.find((s) => s.step === ClosureStep.SETTLE)?.status).toBe(
      ClosureStepStatus.DONE,
    )
  })

  it('is idempotent when SETTLE is already DONE', async () => {
    const { ctx, project } = await seedClosingProject()
    const first = await settleClosure(ctx, project.id)
    expect(first.steps.find((s) => s.step === ClosureStep.SETTLE)?.status).toBe(
      ClosureStepStatus.DONE,
    )
    const second = await settleClosure(ctx, project.id)
    expect(second.steps.find((s) => s.step === ClosureStep.SETTLE)?.completedAt).toBe(
      first.steps.find((s) => s.step === ClosureStep.SETTLE)?.completedAt,
    )
    expect(second.currentStep).toBe(ClosureStep.REVOKE)
  })
})
