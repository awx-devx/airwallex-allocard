import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: '/brand/**', search: '' },
      { pathname: '/images/**', search: '' },
    ],
  },
}

export default nextConfig
