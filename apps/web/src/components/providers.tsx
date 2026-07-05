'use client'

import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { getAccessToken, setAccessToken } from '@/lib/api'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  // App boshlanganda localStorage dagi tokenni in-memory ga tiklash
  useEffect(() => {
    const savedToken = localStorage.getItem('token')
    if (savedToken && !getAccessToken()) {
      setAccessToken(savedToken)
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange={false}
      >
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#181818',
              color: '#f9fafb',
              border: '1px solid #2a2a2a',
              borderRadius: '12px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#f59e0b', secondary: '#111111' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#111111' },
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
