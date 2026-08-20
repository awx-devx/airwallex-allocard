import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cloudflare / ngrok tunnels used for local Airwallex webhooks (ARCHITECTURE §9).
  allowedDevOrigins: ['*.trycloudflare.com', '*.ngrok-free.app', '*.ngrok.app', '*.ngrok.io'],
  images: {
    localPatterns: [
      { pathname: '/brand/**', search: '' },
      { pathname: '/images/**', search: '' },
    ],
  },
}

export default nextConfig
