import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ActorType } from '@/shared/enums/audit'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { MePermissions } from '@/shared/types/mePermissions'
import type { Project } from '@/shared/types/project'
import { SETTINGS_NAV } from '@/client/lib/access'
import {
  WIZARD_STEPS,
  activeOrgRole,
  canCreateProject,
  CARD_STRUCTURE_FLAGS,
  cardStructureReviewLines,
  createProjectDenialMessage,
  draftWizardHref,
  hasBudgetFrom,
  isReadyForApprovalInput,
  launchExplainerMessage,
  missingIssuanceRuleMessage,
  nextWizardStepId,
  normalisedWorkstreamName,
  parseDraftId,
  parseProjectListSearchParams,
  prevWizardStepId,
  projectFromListCache,
  projectListHref,
  projectSortToSorting,
  queueWorkstreamNames,
  sortingToProjectSort,
  toTimelineItem,
  wizardStepIndex,
  withoutPendingWorkstream,
  WORKSPACE_TAB_HREFS,
} from '@/client/lib/projects'

const EMPTY_ME: MePermissions = { projects: [] }

const MEMBER_WITH_CREATE: MePermissions = {
  projects: [
    {
      projectId: 'proj_1',
      permissions: [Permission.PROJECT_CREATE],
      scope: { level: AccessScopeLevel.PROJECT },
    },
  ],
}

const MEMBER_VIEW_ONLY: MePermissions = {
  projects: [
    {
      projectId: 'proj_1',
      permissions: [Permission.PROJECT_VIEW],
      scope: { level: AccessScopeLevel.PROJECT },
    },
  ],
}

describe('WIZARD_STEPS', () => {
  it('is details, budget, card structure, review, launch', () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual([
      'details',
      'budget',
      'card-structure',
      'review',
      'launch',
    ])
    expect(WIZARD_STEPS.filter((step) => step.optional)).toEqual([])
  })

  it('walks next/prev and throws on unknown ids', () => {
    expect(wizardStepIndex('details')).toBe(0)
    expect(nextWizardStepId('details')).toBe('budget')
    expect(nextWizardStepId('budget')).toBe('card-structure')
    expect(nextWizardStepId('card-structure')).toBe('review')
    expect(prevWizardStepId('details')).toBeNull()
    expect(nextWizardStepId('launch')).toBeNull()
    expect(prevWizardStepId('launch')).toBe('review')
    expect(() => wizardStepIndex('nope')).toThrow('Unknown wizard step')
    expect(() => nextWizardStepId('nope')).toThrow()
  })
})

describe('canCreateProject', () => {
  it('allows OWNER and ADMIN even with empty me.projects', () => {
    expect(canCreateProject({ orgRole: OrgRole.OWNER, me: EMPTY_ME })).toBe(true)
    expect(canCreateProject({ orgRole: OrgRole.ADMIN, me: undefined })).toBe(true)
  })

  it('allows MEMBER only when some project grants project.create', () => {
    expect(canCreateProject({ orgRole: OrgRole.MEMBER, me: MEMBER_WITH_CREATE })).toBe(true)
    expect(canCreateProject({ orgRole: OrgRole.MEMBER, me: MEMBER_VIEW_ONLY })).toBe(false)
    expect(canCreateProject({ orgRole: OrgRole.MEMBER, me: EMPTY_ME })).toBe(false)
    expect(canCreateProject({ orgRole: OrgRole.MEMBER, me: undefined })).toBe(false)
  })

  it('denies missing role', () => {
    expect(canCreateProject({ orgRole: undefined, me: MEMBER_WITH_CREATE })).toBe(false)
  })
})

describe('createProjectDenialMessage', () => {
  it('returns the locked sentence', () => {
    expect(createProjectDenialMessage()).toBe("You don't have permission to create a project.")
  })
})

describe('activeOrgRole', () => {
  it('matches orgId and returns undefined otherwise', () => {
    const memberships = [
      { orgId: 'org_a', orgRole: OrgRole.OWNER },
      { orgId: 'org_b', orgRole: OrgRole.MEMBER },
    ]
    expect(activeOrgRole(memberships, 'org_b')).toBe(OrgRole.MEMBER)
    expect(activeOrgRole(memberships, 'org_missing')).toBeUndefined()
    expect(activeOrgRole(memberships, null)).toBeUndefined()
  })
})

describe('draftWizardHref / parseDraftId', () => {
  it('builds /projects/new?draftId= without encoding the id', () => {
    expect(draftWizardHref('proj_1')).toBe('/projects/new?draftId=proj_1')
  })

  it('throws on empty projectId', () => {
    expect(() => draftWizardHref('')).toThrow()
  })

  it('uses the first array element', () => {
    expect(parseDraftId({ draftId: ['proj_a', 'proj_b'] })).toBe('proj_a')
  })

  it('returns null for missing or empty', () => {
    expect(parseDraftId({})).toBeNull()
    expect(parseDraftId({ draftId: '' })).toBeNull()
    expect(parseDraftId({ draftId: [] })).toBeNull()
  })
})

describe('normalisedWorkstreamName / queueWorkstreamNames', () => {
  it('trims and rejects empty or over-long names', () => {
    expect(normalisedWorkstreamName('  APAC  ')).toBe('APAC')
    expect(normalisedWorkstreamName('   ')).toBeNull()
    expect(normalisedWorkstreamName('')).toBeNull()
    expect(normalisedWorkstreamName('x'.repeat(121))).toBeNull()
    expect(normalisedWorkstreamName('x'.repeat(120))).toBe('x'.repeat(120))
  })

  it('appends a typed draft name after pending chips', () => {
    expect(queueWorkstreamNames(['Retail'], '  Field  ')).toEqual(['Retail', 'Field'])
    expect(queueWorkstreamNames(['Retail'], '   ')).toEqual(['Retail'])
    expect(queueWorkstreamNames([], 'Launch')).toEqual(['Launch'])
  })

  it('removes a pending chip by index', () => {
    expect(withoutPendingWorkstream(['Retail', 'Field'], 0)).toEqual(['Field'])
    expect(withoutPendingWorkstream(['Retail', 'Field'], 1)).toEqual(['Retail'])
    expect(withoutPendingWorkstream(['Retail'], 4)).toEqual(['Retail'])
  })
})

describe('parseProjectListSearchParams', () => {
  it('maps known query params onto listProjectsQuery', () => {
    expect(
      parseProjectListSearchParams({
        status: 'ACTIVE',
        ownerId: 'user_1',
        costCentre: 'retail',
        page: '2',
        pageSize: '10',
        sort: '-updatedAt',
      }),
    ).toEqual({
      status: ProjectStatus.ACTIVE,
      ownerId: 'user_1',
      costCentre: 'retail',
      page: 2,
      pageSize: 10,
      sort: '-updatedAt',
    })
  })

  it('uses the first array element', () => {
    expect(parseProjectListSearchParams({ status: ['DRAFT', 'ACTIVE'], page: ['3'] })).toEqual({
      status: ProjectStatus.DRAFT,
      page: 3,
      pageSize: 20,
    })
  })

  it('drops unknown status, sort, and other invalid params', () => {
    expect(parseProjectListSearchParams({ status: 'NOPE' })).toEqual({ page: 1, pageSize: 20 })
    expect(parseProjectListSearchParams({ sort: 'budget' })).toEqual({ page: 1, pageSize: 20 })
    expect(parseProjectListSearchParams({ page: '0' })).toEqual({ page: 1, pageSize: 20 })
    expect(parseProjectListSearchParams({ extra: 'x' } as never)).toEqual({ page: 1, pageSize: 20 })
  })
})

describe('projectListHref', () => {
  it('omits default page and pageSize', () => {
    expect(projectListHref({ page: 1, pageSize: 20 })).toBe('/projects')
    expect(projectListHref({ status: ProjectStatus.ACTIVE })).toBe('/projects?status=ACTIVE')
    expect(projectListHref({ page: 2, sort: '-name' })).toBe('/projects?page=2&sort=-name')
  })
})

describe('sortingToProjectSort / projectSortToSorting', () => {
  it('round-trips known columns', () => {
    expect(sortingToProjectSort({ id: 'name', direction: 'asc' })).toBe('name')
    expect(sortingToProjectSort({ id: 'updatedAt', direction: 'desc' })).toBe('-updatedAt')
    expect(projectSortToSorting('-status')).toEqual({ id: 'status', direction: 'desc' })
    expect(projectSortToSorting('createdAt')).toEqual({ id: 'createdAt', direction: 'asc' })
    expect(projectSortToSorting(undefined)).toBeNull()
  })

  it('ignores unknown column ids', () => {
    expect(sortingToProjectSort({ id: 'budget', direction: 'asc' })).toBeUndefined()
    expect(sortingToProjectSort(null)).toBeUndefined()
  })
})

describe('projectFromListCache', () => {
  it('returns the first matching list item and skips non-lists', () => {
    const project = { id: 'proj_hit' } as Project
    const found = projectFromListCache(
      [
        [['projects', 'proj_other'], { id: 'proj_other' }],
        [['projects', {}], { items: [project] }],
      ],
      'proj_hit',
    )
    expect(found?.id).toBe('proj_hit')
    expect(projectFromListCache([[['projects', {}], null]], 'proj_hit')).toBeUndefined()
  })
})

describe('isReadyForApprovalInput / hasBudgetFrom', () => {
  const ready = {
    name: 'APAC',
    ownerId: 'user_1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-12-31T00:00:00.000Z',
  }

  it('is true only with name, owner, dates, and budget', () => {
    expect(isReadyForApprovalInput(ready, true)).toBe(true)
    expect(isReadyForApprovalInput({ ...ready, ownerId: null }, true)).toBe(false)
    expect(isReadyForApprovalInput({ ...ready, startDate: null }, true)).toBe(false)
    expect(isReadyForApprovalInput({ ...ready, endDate: null }, true)).toBe(false)
    expect(isReadyForApprovalInput(ready, false)).toBe(false)
  })

  it('treats approved amount or snapshot.approved > 0 as hasBudget', () => {
    expect(hasBudgetFrom({ budgetSnapshot: null }, 1)).toBe(true)
    expect(hasBudgetFrom({ budgetSnapshot: { approved: 500 } }, null)).toBe(true)
    expect(hasBudgetFrom({ budgetSnapshot: { approved: 0 } }, 0)).toBe(false)
    expect(hasBudgetFrom({ budgetSnapshot: null }, null)).toBe(false)
  })
})

describe('toTimelineItem', () => {
  it('passes through timeline fields and omits payload', () => {
    expect(
      toTimelineItem({
        id: 'act_1',
        at: '2026-01-01T00:00:00.000Z',
        actorType: ActorType.USER,
        actorId: 'user_1',
        summary: 'Launched',
        subjectType: 'project',
        subjectId: 'proj_1',
      }),
    ).toEqual({
      id: 'act_1',
      at: '2026-01-01T00:00:00.000Z',
      actorType: ActorType.USER,
      actorId: 'user_1',
      summary: 'Launched',
      subjectType: 'project',
      subjectId: 'proj_1',
    })
  })
})

describe('cardStructureReviewLines', () => {
  it('returns four locked sentences', () => {
    const lines = cardStructureReviewLines({
      shared: true,
      perMember: false,
      vendor: true,
      oneTime: false,
    })
    expect(lines).toHaveLength(4)
    expect(lines).toEqual([
      'This project intends a shared card (issued by an enabled rule, not this switch).',
      'This project does not intend per-member cards.',
      'This project intends vendor cards (issued by an enabled rule, not this switch).',
      'This project does not intend one-time cards.',
    ])
  })

  it('explains each card-structure toggle in plain language', () => {
    expect(CARD_STRUCTURE_FLAGS.map((flag) => flag.key)).toEqual([
      'shared',
      'perMember',
      'vendor',
      'oneTime',
    ])
    for (const flag of CARD_STRUCTURE_FLAGS) {
      expect(flag.description.length).toBeGreaterThan(10)
      expect(flag.description.toLowerCase()).not.toContain('pan')
    }
  })
})

describe('launchExplainerMessage', () => {
  it('does not mention events or status enums', () => {
    const copy = launchExplainerMessage()
    expect(copy.toLowerCase()).toContain('launch')
    expect(copy.toLowerCase()).toContain('card')
    expect(copy.toLowerCase()).toContain('rule')
    expect(copy).not.toContain('project.launched')
    expect(copy).not.toContain('ACTIVE')
    expect(copy.toLowerCase()).not.toContain('structure you chose')
  })

  it('points per-member launch at an issuance rule, not structure flags', () => {
    expect(missingIssuanceRuleMessage().toLowerCase()).toContain('issuance rule')
    expect(missingIssuanceRuleMessage()).not.toContain('project.launched')
  })
})

describe('WORKSPACE_TAB_HREFS', () => {
  it('is exactly the six A2 workspace tabs and has no settings', () => {
    const id = 'proj_1'
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).toEqual([
      '/projects/proj_1',
      '/projects/proj_1/people',
      '/projects/proj_1/budget',
      '/projects/proj_1/cards',
      '/projects/proj_1/controls',
      '/projects/proj_1/activity',
    ])
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.tab)).toEqual([
      'Overview',
      'People',
      'Budget',
      'Cards',
      'Controls',
      'Activity',
    ])
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id)).join(' ')).not.toContain('settings')
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/members',
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
  })
})

describe('createProjectDenialMessage copy', () => {
  it('does not mention password', () => {
    expect(createProjectDenialMessage().toLowerCase()).not.toContain('password')
  })
})

describe('A4.9 workspace tabs unchanged', () => {
  it('still includes /budget and has no settings', () => {
    const id = 'proj_1'
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).toContain('/projects/proj_1/budget')
    expect(WORKSPACE_TAB_HREFS).toHaveLength(6)
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id)).join(' ')).not.toContain('settings')
  })
})

describe('A5.10 workspace tabs unchanged', () => {
  it('still includes /cards and has no settings', () => {
    const id = 'proj_1'
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).toContain('/projects/proj_1/cards')
    expect(WORKSPACE_TAB_HREFS).toHaveLength(6)
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id)).join(' ')).not.toContain('settings')
  })
})

describe('A6.11 workspace tabs unchanged', () => {
  it('still includes /controls, has length 6, and SETTINGS_NAV is the five hrefs', () => {
    const id = 'proj_1'
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).toContain('/projects/proj_1/controls')
    expect(WORKSPACE_TAB_HREFS).toHaveLength(6)
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id)).join(' ')).not.toContain('settings')
    expect(SETTINGS_NAV.map((item) => item.href)).toEqual([
      '/settings/members',
      '/settings/roles',
      '/settings/access-reviews',
      '/settings/rules',
      '/settings/attributes',
    ])
  })
})

describe('A7.9 workspace tabs unchanged', () => {
  it('still includes /controls, has length 6, and has no project requests tab', () => {
    const id = 'proj_1'
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).toContain('/projects/proj_1/controls')
    expect(WORKSPACE_TAB_HREFS).toHaveLength(6)
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id)).join(' ')).not.toContain('settings')
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).not.toContain(
      '/projects/proj_1/requests',
    )
  })
})

describe('A8.8 workspace tabs unchanged', () => {
  it('still includes /activity, has length 6, and has no project transactions tab', () => {
    const id = 'proj_1'
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).toContain('/projects/proj_1/activity')
    expect(WORKSPACE_TAB_HREFS).toHaveLength(6)
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id)).join(' ')).not.toContain('settings')
    expect(WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))).not.toContain(
      '/projects/proj_1/transactions',
    )
  })
})

describe('A9.9 workspace tabs unchanged', () => {
  it('still includes /activity, has length 6, and has no closure or final-report tab', () => {
    const id = 'proj_1'
    const hrefs = WORKSPACE_TAB_HREFS.map((tab) => tab.href(id))
    expect(hrefs).toContain('/projects/proj_1/activity')
    expect(WORKSPACE_TAB_HREFS).toHaveLength(6)
    expect(hrefs.join(' ')).not.toContain('settings')
    expect(hrefs).not.toContain('/projects/proj_1/closure')
    expect(hrefs.join(' ')).not.toContain('/audit')
    expect(hrefs.join(' ')).not.toContain('report/final')
  })
})

describe('A2 screens never mention PAN', () => {
  it('has no PAN, cvv, or card_number under projects or dashboard', () => {
    function walk(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        return entry.isDirectory() ? walk(path) : [path]
      })
    }

    const roots = [
      join(process.cwd(), 'src/app/(app)/projects'),
      join(process.cwd(), 'src/app/(app)/dashboard'),
    ]
    const files = roots.flatMap(walk)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const src = readFileSync(file, 'utf8').replace(
        /Card structure flags only — never a PAN\./g,
        '',
      )
      expect(src, file).not.toMatch(/\bPAN\b/)
      expect(src.toLowerCase(), file).not.toContain('cvv')
      expect(src.toLowerCase(), file).not.toContain('card_number')
    }
  })
})
