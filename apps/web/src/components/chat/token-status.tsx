'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { PLAN_LIMITS } from '@go-ai/shared'

const REFRESH_INTERVAL_MS = 60_000

function formatSeconds(seconds: number) {
  if (seconds <= 0) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

export function TokenStatus() {
  const { user, isAuthenticated, fetchMe } = useAuthStore()
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(REFRESH_INTERVAL_MS / 1000))
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isAuthenticated) return

    let mounted = true
    let interval: NodeJS.Timeout | null = null
    let ticker: NodeJS.Timeout | null = null

    const refresh = async () => {
      if (!mounted) return
      setRefreshing(true)
      setSecondsLeft(Math.ceil(REFRESH_INTERVAL_MS / 1000))
      try {
        await fetchMe()
      } finally {
        if (mounted) setRefreshing(false)
      }
    }

    void refresh()

    ticker = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) return 0
        return current - 1
      })
    }, 1000)

    interval = setInterval(() => {
      void refresh()
    }, REFRESH_INTERVAL_MS)

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
      if (ticker) clearInterval(ticker)
    }
  }, [fetchMe, isAuthenticated])

  if (!user) return null

  const monthlyTokensRemaining = user.monthlyTokensRemaining
  const planLimit = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS]?.monthlyTokens
  const remainingText = typeof monthlyTokensRemaining === 'number'
    ? `Remaining this month: ${monthlyTokensRemaining.toLocaleString()}`
    : planLimit
      ? `Plan monthly limit: ${planLimit.toLocaleString()}`
      : 'Monthly quota unavailable'

  return (
    <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground md:flex">
      <span className="font-medium text-foreground">Tokens: {user.tokenBalance ?? 0}</span>
      <span className="text-muted-foreground/80">•</span>
      <span>{remainingText}</span>
      <span className="text-muted-foreground/80">•</span>
      <span>{refreshing ? 'Refreshing…' : `Refresh in ${formatSeconds(secondsLeft)}`}</span>
    </div>
  )
}
