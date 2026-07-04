'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuthStore } from '@/store/auth.store'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, fetchMe } = useAuthStore()
  const router = useRouter()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const { isAuthenticated: auth, user } = useAuthStore.getState()

    // If not authenticated at all, redirect to login
    if (!auth) {
      router.replace('/login')
      return
    }

    // If authenticated but no user data yet, fetch it
    if (!user) {
      fetchMe()
    }

    // Listen for sidebar search shortcut
    const handler = (e: Event) => {
      // handled in sidebar
    }
    window.addEventListener('open-search', handler)
    return () => window.removeEventListener('open-search', handler)
  }, [hydrated])

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
