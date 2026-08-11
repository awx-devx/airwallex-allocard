import { describe, expect, it } from 'vitest'
import {
  approvalCountQueryOptions,
  attributeValuesQueryOptions,
  cardLimitsQueryOptions,
  ruleRunsInFlightQueryOptions,
} from '@/client/hooks/queryDefaults'

describe('queryDefaults', () => {
  it('exports F1 per-hook overrides', () => {
    expect(cardLimitsQueryOptions.staleTime).toBe(15_000)
    expect(approvalCountQueryOptions).toEqual({
      staleTime: 30_000,
      refetchInterval: 30_000,
    })
    expect(ruleRunsInFlightQueryOptions).toEqual({
      staleTime: 10_000,
      refetchInterval: 10_000,
    })
    expect(attributeValuesQueryOptions.staleTime).toBe(5_000)
  })
})
