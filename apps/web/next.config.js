/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@go-ai/shared'],
  images: {
    domains: [
      'localhost',
      'image.pollinations.ai',
      'avatars.githubusercontent.com',
      'lh3.googleusercontent.com',
      's3.amazonaws.com',
      // Production domeningizni qo'shing:
      // 'yourdomain.com',
      // 'api.yourdomain.com',
    ],
    remotePatterns: [
      { protocol: 'https', hostname: 'image.pollinations.ai' },
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3010',
        // Production:
        // 'yourdomain.com',
        // 'api.yourdomain.com',
      ],
    },
  },
  // Production build optimizatsiya
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
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

// PWA — production da yoqiladi
let config = nextConfig
try {
  const withPWA = require('next-pwa')({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    register: true,
    skipWaiting: true,
    reloadOnOnline: true,
    cacheOnFrontEndNav: true,
  })
  config = withPWA(nextConfig)
} catch {
  // next-pwa not available
}

module.exports = config
