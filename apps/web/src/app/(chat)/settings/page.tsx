'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Bell, Shield, Palette, Cpu, CreditCard,
  Key, MemoryStick, ChevronRight, ArrowLeft, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { AppearanceSettings } from '@/components/settings/appearance-settings'
import { ModelSettings } from '@/components/settings/model-settings'
import { SecuritySettings } from '@/components/settings/security-settings'
import { ApiKeysSettings } from '@/components/settings/api-keys-settings'
import { MemorySettings } from '@/components/settings/memory-settings'

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'models', label: 'AI Models', icon: Cpu },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'memory', label: 'Memory', icon: MemoryStick },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<string | null>(null)
  // Mobile: null = list ko'rinadi, string = content ko'rinadi

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileSettings />
      case 'appearance': return <AppearanceSettings />
      case 'models': return <ModelSettings />
      case 'security': return <SecuritySettings />
      case 'api-keys': return <ApiKeysSettings />
      case 'memory': return <MemorySettings />
      default: return <div className="text-muted-foreground text-sm p-4">Coming soon</div>
    }
  }

  const activeTabMeta = TABS.find(t => t.id === activeTab)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 shrink-0">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => {
            if (activeTab && window.innerWidth < 768) {
              setActiveTab(null)
            } else {
              router.back()
            }
          }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold">
          {activeTab && window.innerWidth < 768 && activeTabMeta
            ? activeTabMeta.label
            : 'Settings'}
        </h1>
      </div>

      {/* Desktop: side-by-side | Mobile: list → detail */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar nav — desktop always shown, mobile only when no tab selected */}
        <div className={cn(
          'border-r border-border p-3 shrink-0 overflow-y-auto',
          'w-full md:w-56',
          // Mobile: hide when tab selected
          activeTab ? 'hidden md:block' : 'block'
        )}>
          <nav className="space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
                    activeTab === tab.id
                      ? 'bg-secondary text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  <ChevronRight className="h-4 w-4 opacity-40 md:hidden" />
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content — desktop always shown, mobile only when tab selected */}
        <div className={cn(
          'flex-1 overflow-y-auto',
          !activeTab ? 'hidden md:block' : 'block'
        )}>
          {activeTab ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
              className="p-4 md:p-8"
            >
              {renderContent()}
            </motion.div>
          ) : (
            // Desktop default: show profile
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 hidden md:block"
            >
              <ProfileSettings />
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
