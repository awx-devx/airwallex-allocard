import { describe, expect, it } from 'vitest'
import { timelineActorChipLabel } from '@/components/patterns/timelineActor'
import { ActorType } from '@/shared/enums/audit'

describe('timelineActorChipLabel', () => {
  it('prefers the person name over ActorType User', () => {
    expect(timelineActorChipLabel(ActorType.USER, 'Seed Owner')).toBe('Seed Owner')
    expect(timelineActorChipLabel(ActorType.USER, undefined)).toBe('User')
    expect(timelineActorChipLabel(ActorType.USER, '')).toBe('User')
    expect(timelineActorChipLabel(ActorType.RULE, 'Freeze')).toBe('Freeze')
    expect(timelineActorChipLabel(ActorType.SYSTEM, undefined)).toBe('System')
  })
})
