import { describe, expect, it } from 'vitest'
import { qk } from '@/client/queryKeys'

describe('qk', () => {
  it('returns readonly hierarchical tuples', () => {
    expect(qk.me()).toEqual(['me'])
    expect(qk.permissions()).toEqual(['me', 'permissions'])
    expect(qk.projects()).toEqual(['projects', {}])
    expect(qk.projects({ page: 1, pageSize: 20 })).toEqual(['projects', { page: 1, pageSize: 20 }])
    expect(qk.project('p1')).toEqual(['projects', 'p1'])
    expect(qk.budget('p1')).toEqual(['projects', 'p1', 'budget'])
    expect(qk.card('c1')).toEqual(['cards', 'c1'])
    expect(qk.cardLimits('c1')).toEqual(['cards', 'c1', 'limits'])
    expect(qk.activity()).toEqual(['activity', 'org'])
    expect(qk.activity('p1')).toEqual(['activity', 'p1'])
  })

  it('budget key is prefixed by project key', () => {
    const project = qk.project('p1')
    const budget = qk.budget('p1')
    expect(budget.slice(0, project.length)).toEqual([...project])
  })

  it('cardLimits / cardExplain are prefixed by card key', () => {
    const card = qk.card('c1')
    expect(qk.cardLimits('c1').slice(0, card.length)).toEqual([...card])
    expect(qk.cardExplain('c1').slice(0, card.length)).toEqual([...card])
  })

  it('exposes extra inventory keys', () => {
    expect(qk.org('o1')).toEqual(['organizations', 'o1'])
    expect(qk.orgMembers('o1')).toEqual(['organizations', 'o1', 'members'])
    expect(qk.invites()).toEqual(['invites'])
    expect(qk.invitePreview('tok')).toEqual(['invites', 'preview', 'tok'])
    expect(qk.roles()).toEqual(['roles'])
    expect(qk.workstreams('p1')).toEqual(['projects', 'p1', 'workstreams'])
    expect(qk.closureStatus('p1')).toEqual(['projects', 'p1', 'closure', 'status'])
    expect(qk.projectReport('p1')).toEqual(['reports', 'project', 'p1'])
    expect(qk.onboardingStatus()).toEqual(['onboarding', 'status'])
    expect(qk.attributeValues()).toEqual(['attributes', 'values', {}])
    expect(qk.declinedTransactions()).toEqual(['transactions', 'declined', {}])
  })
})
