'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AicraftLogo } from '@/components/ui/aicraft-logo'
import { api, getApiError } from '@/lib/api'
import toast from 'react-hot-toast'
import Link from 'next/link'

function ResetPasswordContent() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params?.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      toast.success('Password reset successfully!')
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setLoading(false)
    }
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
        className="relative w-full max-w-sm"
      >
        <div className="flex justify-center mb-6">
          <AicraftLogo size={36} />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-xl shadow-black/20">
          {done ? (
            <div className="text-center space-y-3 py-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <span className="text-2xl">✅</span>
              </div>
              <h2 className="text-xl font-semibold">Password updated!</h2>
              <p className="text-sm text-muted-foreground">Redirecting to login...</p>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h1 className="text-xl md:text-2xl font-semibold">Reset password</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">Enter your new password below</p>
              </div>

              {!token && (
                <div className="mb-4 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                  Invalid or expired reset link. Please request a new one.
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="h-11 pr-10"
                      disabled={!token}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-11"
                    disabled={!token}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11"
                  loading={loading}
                  disabled={!token || loading}
                >
                  Reset Password
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-primary hover:underline">
            ← Back to login
          </Link>
        </p>
      </motion.div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
