'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon, Monitor, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

const THEMES = [
  { id: 'dark', label: 'Dark', icon: Moon, description: 'Easy on the eyes' },
  { id: 'light', label: 'Light', icon: Sun, description: 'Classic bright theme' },
  { id: 'system', label: 'System', icon: Monitor, description: 'Follows your OS' },
]

const FONT_SIZES = [
  { id: 'sm', label: 'Small', preview: 'text-sm' },
  { id: 'md', label: 'Medium', preview: 'text-base' },
  { id: 'lg', label: 'Large', preview: 'text-lg' },
]

// Only 3 supported languages
const LANGUAGES = [
  { id: 'uz', label: "O'zbek", flag: '🇺🇿' },
  { id: 'ru', label: 'Русский', flag: '🇷🇺' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
]

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState('uz')

  useEffect(() => {
    async function loadSettings() {
      try {
        const { data } = await api.get('/users/me/settings')
        if (data?.data?.language) {
          setLanguage(data.data.language)
        }
      } catch {
        // ignore load errors
      }
    }
    loadSettings()
  }, [])

  const handleThemeChange = async (newTheme: string) => {
    setTheme(newTheme)
    try {
      await api.patch('/users/me/settings', { theme: newTheme })
    } catch {
      toast.error('Failed to save theme preference')
    }
  }

  const handleLanguageChange = async (newLanguage: string) => {
    setLanguage(newLanguage)
    try {
      await api.patch('/users/me/settings', { language: newLanguage })
      toast.success('Til saqlandi')
    } catch {
      toast.error('Failed to save language preference')
    }
  }

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground">Customize how aicraft looks for you</p>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Theme</label>
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const Icon = t.icon
            const isActive = theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                className={cn(
                  'relative flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
                )}
              >
                {isActive && (
                  <div className="absolute top-2 right-2 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </div>
                )}
                <Icon className="h-6 w-6" />
                <div className="text-center">
                  <p className="text-xs font-medium">{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Language — only UZ / RU / EN */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Interface Language</label>
        <p className="text-xs text-muted-foreground -mt-1">
          AI automatically replies in the language you write in
        </p>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.id}
              onClick={() => handleLanguageChange(lang.id)}
              className={cn(
                'rounded-xl border p-4 text-center transition-all duration-200',
                language === lang.id
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border hover:border-primary/50 text-muted-foreground hover:text-foreground'
              )}
            >
              <p className="text-2xl mb-1">{lang.flag}</p>
              <p className="text-sm font-medium">{lang.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Font Size</label>
        <div className="flex gap-3">
          {FONT_SIZES.map((size) => (
            <button
              key={size.id}
              className={cn(
                'flex-1 rounded-xl border border-border py-3 text-center transition-all',
                'hover:border-primary/50'
              )}
            >
              <span className={cn('font-medium', size.preview)}>{size.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <label className="text-sm font-medium">Preview</label>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center shrink-0">
              <span className="text-xs">U</span>
            </div>
            <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
              Salom, qanday yordam bera olasiz?
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-xs text-primary">AI</span>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-2.5 text-sm">
              Salom! Sizga har qanday savolda yordam berishga tayyorman.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
