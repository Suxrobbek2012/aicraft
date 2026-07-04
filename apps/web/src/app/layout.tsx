import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
// Fix: geist font package not available in this repo. Remove dependency to avoid Module not found.
// import { GeistMono } from 'geist/font/mono'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'aicraft — Your Intelligent Assistant',
    template: '%s | aicraft',
  },
  description:
    'Production-ready AI SaaS platform. Chat with GPT-4o, Claude, Gemini, Grok, and more. Analyze files, generate code, and boost productivity.',
  keywords: ['AI', 'chatbot', 'GPT', 'Claude', 'assistant', 'productivity'],
  authors: [{ name: 'aicraft' }],
  creator: 'aicraft',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3011'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: 'aicraft — Your Intelligent Assistant',
    description: 'Chat with the world\'s best AI models in one place.',
    siteName: 'aicraft',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'aicraft',
    description: 'Chat with the world\'s best AI models in one place.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#111111' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
