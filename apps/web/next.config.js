/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@go-ai/shared'],
  images: {
    domains: [
      'localhost',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      's3.amazonaws.com',
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3010'] },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

// Only wrap with PWA in production to avoid dev issues
let config = nextConfig
try {
  const withPWA = require('next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
  })
  config = withPWA(nextConfig)
} catch {
  // next-pwa not available, use base config
}

module.exports = config
