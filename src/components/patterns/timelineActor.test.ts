import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

describe('TimelinePanel', () => {
  it('fills leftover as the main block and caps when stacked', () => {
    const src = readFileSync(join(process.cwd(), 'src/components/patterns/Timeline.tsx'), 'utf8')
    expect(src).toContain('function TimelinePanel')
    expect(src).toContain('min-h-64')
    expect(src).toContain('max-h-80')
    expect(src).toContain('overflow-y-auto')
    expect(src).toContain("fill ? 'flex-1' : 'max-h-80'")
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})
