import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publicAsset } from '@/lib/assets'

function publicPath(url: string): string {
  return join(process.cwd(), 'public', url.replace(/^\//, ''))
}

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function pngColorType(buf: Buffer): number {
  expect(buf.subarray(0, 8).equals(PNG_SIG), 'PNG signature').toBe(true)
  return buf[25] ?? -1
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

  it('ships App Router favicon files that match the public brand squares', () => {
    const app = (name: string) => join(process.cwd(), 'src/app', name)
    const icon = readFileSync(publicPath(publicAsset.icon))
    const ico = readFileSync(app('favicon.ico'))
    expect(existsSync(app('favicon.ico'))).toBe(true)
    expect(readFileSync(app('icon.png')).equals(icon)).toBe(true)
    expect(
      readFileSync(app('apple-icon.png')).equals(
        readFileSync(publicPath(publicAsset.appleTouchIcon)),
      ),
    ).toBe(true)
    expect(pngColorType(icon)).toBe(6)
    const icoPngOffset = ico.readUInt32LE(18)
    expect(pngColorType(ico.subarray(icoPngOffset))).toBe(6)
    expect(ico.length).toBeGreaterThan(1000)
  })
})
