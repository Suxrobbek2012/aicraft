'use client'

import React, { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Check, X, Loader2, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'

function VerifyEmailContent() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="text-center max-w-sm">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Bot className="h-6 w-6 text-primary" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
            <h2 className="text-xl font-semibold">Verifying your email...</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Email verified!</h2>
            <p className="text-muted-foreground text-sm mb-6">Your account is ready. Start chatting now.</p>
            <Button onClick={() => router.push('/chat')} className="w-full">Go to App</Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <X className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Verification failed</h2>
            <p className="text-muted-foreground text-sm mb-6">This link is invalid or expired.</p>
            <Button onClick={() => router.push('/login')} className="w-full">Back to Login</Button>
          </>
        )}
      </motion.div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
        <h2 className="text-xl font-semibold">Loading...</h2>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
