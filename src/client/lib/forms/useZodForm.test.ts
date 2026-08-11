import { describe, expect, it } from 'vitest'
import { createZodFormConfig } from '@/client/lib/forms/useZodForm'
import { createProjectInput } from '@/shared/schemas/project'

describe('client/lib/forms/useZodForm', () => {
  it('createZodFormConfig wires zodResolver for createProjectInput', () => {
    const config = createZodFormConfig(createProjectInput)
    expect(config.resolver).toBeDefined()
    expect(typeof config.resolver).toBe('function')
  })

  it('resolver rejects invalid createProjectInput', async () => {
    const { resolver } = createZodFormConfig(createProjectInput)
    const result = await resolver!(
      { name: '', code: 'bad code!' },
      {},
      { fields: {}, shouldUseNativeValidation: false },
    )
    expect(result.errors).toBeDefined()
    expect(Object.keys(result.errors).length).toBeGreaterThan(0)
  })

  it('resolver accepts valid createProjectInput', async () => {
    const { resolver } = createZodFormConfig(createProjectInput)
    const result = await resolver!(
      { name: 'APAC Launch', code: 'APAC-2026' },
      {},
      { fields: {}, shouldUseNativeValidation: false },
    )
    expect(result.values).toEqual({ name: 'APAC Launch', code: 'APAC-2026' })
  })
})
