'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  User, Bell, Shield, Palette, Cpu, CreditCard,
  Key, MemoryStick, Puzzle, ChevronRight, ArrowLeft,
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
  const [activeTab, setActiveTab] = useState('profile')

  const renderContent = () => {
    switch (activeTab) {
      case 'profile': return <ProfileSettings />
      case 'appearance': return <AppearanceSettings />
      case 'models': return <ModelSettings />
      case 'security': return <SecuritySettings />
      case 'api-keys': return <ApiKeysSettings />
      case 'memory': return <MemorySettings />
      default: return <div className="text-muted-foreground text-sm">Coming soon</div>
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-56 border-r border-border p-3 shrink-0">
          <nav className="space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                    activeTab === tab.id
                      ? 'bg-secondary text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
          >
            {renderContent()}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
