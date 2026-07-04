'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Bot, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import toast from 'react-hot-toast'
import { AicraftLogo } from '@/components/ui/aicraft-logo'

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
]

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading, error } = useAuthStore()

  const [form, setForm] = useState({
    email: '',
    username: '',
    displayName: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState(false)
  const [usernameError, setUsernameError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'username') {
      if (value && !/^[A-Za-z0-9_-]+$/.test(value)) {
        setUsernameError('Letters, numbers, underscores and hyphens only')
      } else {
        setUsernameError('')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[A-Za-z0-9_-]+$/.test(form.username)) {
      setUsernameError('Letters, numbers, underscores and hyphens only')
      return
    }
    try {
      await register(form)
      setSuccess(true)
    } catch {
      // error from store
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-sm"
        >
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Check your email</h2>
          <p className="text-muted-foreground mb-6">
            We sent a verification link to <strong>{form.email}</strong>. Click it to activate your account.
          </p>
          <Button onClick={() => router.push('/login')} className="w-full">
            Go to Login
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm"
      >
        <div className="flex justify-center mb-8">
          <AicraftLogo size={36} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-black/20">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-semibold">Create account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start with 20 free messages per day
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Display Name</label>
              <Input
                name="displayName"
                value={form.displayName}
                onChange={handleChange}
                placeholder="John Doe"
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Username</label>
                <Input
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="johndoe"
                autoComplete="off"
                required
              />
              {usernameError && (
                <p className="text-xs text-destructive">{usernameError}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength */}
              {form.password && (
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {PASSWORD_RULES.map((rule) => (
                    <div key={rule.label} className="flex items-center gap-1.5">
                      <div className={`h-1.5 w-1.5 rounded-full ${rule.test(form.password) ? 'bg-primary' : 'bg-border'}`} />
                      <span className={`text-xs ${rule.test(form.password) ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full h-10" loading={isLoading}>
              Create account
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-4 text-xs text-center text-muted-foreground">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-primary hover:underline">Terms</Link> and{' '}
            <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
          </p>
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
