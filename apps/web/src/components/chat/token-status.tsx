'use client'

import { Infinity as InfinityIcon, Zap, Crown } from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'

const PLAN_LABELS: Record<string, string> = {
  FREE: 'Free',
  PRO: 'Pro',
  ULTRA: 'Ultra',
  ORG: 'Org',
}

export function TokenStatus() {
  const { user, isAuthenticated } = useAuthStore()

  if (!user || !isAuthenticated) return null

  const plan = (user.plan as string) ?? 'FREE'
  const label = PLAN_LABELS[plan] ?? plan

  // Show only for paid plans
  if (plan === 'FREE') return null

  const isUnlimited = plan === 'ULTRA' || plan === 'ORG'

  return (
    <div className="hidden items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground md:flex">
      {plan === 'ULTRA' || plan === 'ORG' ? (
        <Crown className="h-3 w-3 text-yellow-400" />
      ) : (
        <Zap className="h-3 w-3 text-primary" />
      )}
      <span className="font-medium text-foreground">Aicraft {label}</span>
      <span className="text-muted-foreground/80">•</span>
      {isUnlimited ? (
        <span className="flex items-center gap-0.5 text-primary font-medium">
          <InfinityIcon className="h-3 w-3" /> Unlimited
        </span>
      ) : (
        <span className="text-primary font-medium">Active</span>
      )}
    </div>
  )
}
