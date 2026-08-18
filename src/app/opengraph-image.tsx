import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Allocard'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OpenGraphImage() {
  const fontPath = join(process.cwd(), 'src/app/fonts/Satoshi-Black.woff2')
  const markPath = join(process.cwd(), 'public/brand/logomark.png')
  const [font, mark] = await Promise.all([readFile(fontPath), readFile(markPath)])

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        background: '#000000',
      }}
    >
      <img
        src={`data:image/png;base64,${mark.toString('base64')}`}
        width={240}
        height={180}
        alt=""
      />
      <div
        style={{
          marginTop: 36,
          fontSize: 72,
          fontFamily: 'Satoshi',
          color: '#FFFFFF',
          letterSpacing: '-0.04em',
        }}
      >
        Allocard
      </div>
      <div style={{ marginTop: 12, fontSize: 28, color: '#A3A3A3' }}>
        Dynamic budget cards on Airwallex
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'Satoshi', data: font, weight: 900, style: 'normal' }],
    },
  )
}
