import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button asChild', () => {
  it('slots onto a single anchor without throwing', () => {
    const html = renderToStaticMarkup(
      createElement(
        Button,
        { asChild: true },
        createElement('a', { href: '/projects/new' }, 'Create project'),
      ),
    )
    expect(html).toContain('Create project')
    expect(html).toContain('href="/projects/new"')
    expect(html).not.toContain('<button')
  })
})
