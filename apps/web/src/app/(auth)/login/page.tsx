'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Github, Chrome, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { AicraftLogo } from '@/components/ui/aicraft-logo'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading, error } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const result = await login(email, password, totpCode || undefined)
      if (result.requiresTwoFactor) {
        setRequiresTwoFactor(true)
        toast('Enter your 2FA code to continue', { icon: '🔐' })
        return
      }
      toast.success('Welcome back!')
      router.push('/chat')
    } catch (err: unknown) {
      // error shown from store
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      {/* Background gradient */}
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
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <AicraftLogo size={36} />
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-xl shadow-black/20">
          <div className="mb-5 text-center">
            <h1 className="text-xl md:text-2xl font-semibold text-foreground">
              {requiresTwoFactor ? 'Two-Factor Auth' : 'Welcome back'}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {requiresTwoFactor
                ? 'Enter the 6-digit code from your authenticator app'
                : 'Sign in to your aicraft account'}
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
            {requiresTwoFactor ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Authenticator Code</label>
                <Input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-xl tracking-[0.5em] font-mono h-12"
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">Password</label>
                    <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-base"
              loading={isLoading}
              disabled={isLoading || (requiresTwoFactor && totpCode.length !== 6)}
            >
              {requiresTwoFactor ? 'Verify' : 'Sign in'}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>

          {!requiresTwoFactor && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="h-11 gap-2" disabled>
                  <Chrome className="h-4 w-4" />
                  Google
                </Button>
                <Button variant="outline" className="h-11 gap-2" disabled>
                  <Github className="h-4 w-4" />
                  GitHub
                </Button>
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary font-medium hover:underline">
            Sign up free
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
