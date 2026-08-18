import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publicAsset } from '@/lib/assets'

function publicPath(url: string): string {
  return join(process.cwd(), 'public', url.replace(/^\//, ''))
}

describe('public assets', () => {
  it('maps each brand URL to a file under public/', () => {
    const urls = Object.values(publicAsset)
    expect(urls.length).toBeGreaterThan(0)
    for (const url of urls) {
      expect(url.startsWith('/'), url).toBe(true)
      expect(existsSync(publicPath(url)), url).toBe(true)
    }
  })

  it('ships Satoshi Black for the wordmark', () => {
    expect(existsSync(join(process.cwd(), 'src/app/fonts/Satoshi-Black.woff2'))).toBe(true)
    expect(publicAsset.wordmark).toBe('/brand/wordmark.svg')
  })
})
