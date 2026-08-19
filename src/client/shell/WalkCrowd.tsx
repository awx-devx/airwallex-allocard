'use client'

import { useEffect, useState, type CSSProperties } from 'react'

const CROWD: {
  dir: 'ltr' | 'rtl'
  cross: number
  delay: number
  stride: number
  strideOff: number
  scale: number
  floor: string
  ink: number
}[] = [
  {
    dir: 'ltr',
    cross: 32,
    delay: -6,
    stride: 0.62,
    strideOff: -0.08,
    scale: 1.12,
    floor: '0.04rem',
    ink: 0.52,
  },
  {
    dir: 'rtl',
    cross: 38,
    delay: -19,
    stride: 0.7,
    strideOff: -0.41,
    scale: 0.86,
    floor: '0.38rem',
    ink: 0.34,
  },
  {
    dir: 'ltr',
    cross: 45,
    delay: -27,
    stride: 0.78,
    strideOff: -0.22,
    scale: 0.74,
    floor: '0.62rem',
    ink: 0.26,
  },
  {
    dir: 'rtl',
    cross: 29,
    delay: -11,
    stride: 0.58,
    strideOff: -0.33,
    scale: 1.05,
    floor: '0.1rem',
    ink: 0.48,
  },
  {
    dir: 'ltr',
    cross: 41,
    delay: -2,
    stride: 0.72,
    strideOff: -0.5,
    scale: 0.92,
    floor: '0.28rem',
    ink: 0.38,
  },
  {
    dir: 'rtl',
    cross: 36,
    delay: -22,
    stride: 0.66,
    strideOff: -0.14,
    scale: 1,
    floor: '0.14rem',
    ink: 0.44,
  },
  {
    dir: 'ltr',
    cross: 48,
    delay: -14,
    stride: 0.82,
    strideOff: -0.61,
    scale: 0.7,
    floor: '0.72rem',
    ink: 0.22,
  },
  {
    dir: 'rtl',
    cross: 33,
    delay: -8,
    stride: 0.64,
    strideOff: -0.27,
    scale: 0.96,
    floor: '0.22rem',
    ink: 0.4,
  },
  {
    dir: 'ltr',
    cross: 27,
    delay: -24,
    stride: 0.56,
    strideOff: -0.05,
    scale: 1.18,
    floor: '0.02rem',
    ink: 0.55,
  },
  {
    dir: 'rtl',
    cross: 43,
    delay: -16,
    stride: 0.76,
    strideOff: -0.48,
    scale: 0.8,
    floor: '0.5rem',
    ink: 0.3,
  },
  {
    dir: 'ltr',
    cross: 39,
    delay: -31,
    stride: 0.68,
    strideOff: -0.19,
    scale: 0.88,
    floor: '0.34rem',
    ink: 0.36,
  },
]

export function WalkCrowd() {
  const [reduce, setReduce] = useState(true)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduce(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  if (reduce) return null

  return (
    <div className="walk-crowd" aria-hidden>
      {CROWD.map((person, index) => (
        <div
          key={index}
          className={person.dir === 'rtl' ? 'walk-person is-rtl' : 'walk-person'}
          style={
            {
              '--walk-cross': `${person.cross}s`,
              '--walk-delay': `${person.delay}s`,
              '--walk-stride': `${person.stride}s`,
              '--walk-stride-off': `${person.strideOff}s`,
              '--walk-scale': String(person.scale),
              '--walk-floor': person.floor,
              '--walk-ink': String(person.ink),
              zIndex: Math.round(person.scale * 10),
            } as CSSProperties
          }
        >
          <svg className="walk-face" viewBox="0 0 24 40">
            <g className="walk-orient">
              <g
                className="walk-bob"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.35"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="5.2" r="3.05" />
                <path d="M12 8.3v13.3" />
                <g className="walk-arm-l">
                  <path d="M12 12.6v5.6" />
                  <g className="walk-fore-l">
                    <path d="M12 18.2v5.1" />
                  </g>
                </g>
                <g className="walk-arm-r">
                  <path d="M12 12.6v5.6" />
                  <g className="walk-fore-r">
                    <path d="M12 18.2v5.1" />
                  </g>
                </g>
                <g className="walk-thigh-l">
                  <path d="M12 21.6v6.9" />
                  <g className="walk-shin-l">
                    <path d="M12 28.5v7.1" />
                    <path d="M12 35.6h3.2" />
                  </g>
                </g>
                <g className="walk-thigh-r">
                  <path d="M12 21.6v6.9" />
                  <g className="walk-shin-r">
                    <path d="M12 28.5v7.1" />
                    <path d="M12 35.6h3.2" />
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </div>
      ))}
    </div>
  )
}
