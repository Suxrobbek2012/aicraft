'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { useAuthStore } from '@/store/auth.store'

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { fetchMe } = useAuthStore()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
    // Desktop da default ochiq
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      setSidebarOpen(true)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const { isAuthenticated, user } = useAuthStore.getState()
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (!user) fetchMe()
  }, [hydrated])

  // ChatHeader dagi Menu tugmasidan event
  useEffect(() => {
    const openHandler = () => setSidebarOpen(true)
    const closeHandler = () => {
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setSidebarOpen(false)
      }
    }
    window.addEventListener('sidebar-open', openHandler)
    window.addEventListener('sidebar-close', closeHandler)
    return () => {
      window.removeEventListener('sidebar-open', openHandler)
      window.removeEventListener('sidebar-close', closeHandler)
    }
  }, [])

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] ios-h-fix overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={[
          'fixed md:relative inset-y-0 left-0 z-30',
          'h-[100dvh] w-64 md:w-auto',
          'transition-transform duration-300 ease-in-out will-change-transform',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        <Sidebar
          collapsed={!sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        {children}
      </main>
    </div>
  )
}
