'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, Sparkles, ArrowLeft, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth.store'
import { api, getApiError } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const PLANS = [
  {
    id: 'FREE',
    name: 'Free',
    price: 0,
    icon: Sparkles,
    color: 'text-muted-foreground',
    features: [
      '20 messages per day',
      'GPT-4o Mini, Gemini Flash',
      'File uploads (5MB)',
      '50 conversations',
      'aicraft local models',
      'Basic support',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: 20,
    icon: Zap,
    color: 'text-yellow-400',
    recommended: true,
    features: [
      '200 messages per day',
      'All AI models (GPT-4o, Claude 3.5, Gemini)',
      'Vision & image analysis',
      'File uploads (25MB)',
      'Voice input & TTS',
      'Long-term memory',
      'API access (5 keys)',
      'Plugin support',
      'Priority support',
    ],
  },
  {
    id: 'ULTRA',
    name: 'Ultra',
    price: 100,
    icon: Crown,
    color: 'text-purple-400',
    features: [
      'Unlimited messages',
      'All AI models',
      'File uploads (50MB)',
      'Unlimited API keys (20)',
      'Workspace & team features',
      'Advanced analytics',
      'Custom system prompts',
      'Priority support',
      'Early access to new features',
    ],
  },
]

export default function BillingPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)

  const handleUpgrade = async (planId: string) => {
    if (planId === 'FREE' || planId === user?.plan) return
    setLoading(planId)
    try {
      const { data } = await api.post('/subscriptions/create-checkout', { plan: planId })
      window.location.href = data.data.url
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setLoading(null)
    }
  }

  const handleManage = async () => {
    try {
      const { data } = await api.post('/subscriptions/create-portal')
      window.open(data.data.url, '_blank')
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Button variant="ghost" size="icon-sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-lg font-semibold">Billing & Plans</h1>
        {user?.plan !== 'FREE' && (
          <Button size="sm" variant="outline" onClick={handleManage} className="ml-auto gap-2">
            <ExternalLink className="h-4 w-4" /> Manage Subscription
          </Button>
        )}
      </div>

      <div className="p-8 max-w-5xl mx-auto w-full">
        {/* Current plan banner */}
        <div className="mb-8 rounded-xl border border-border bg-card p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="text-lg font-semibold">{user?.plan}</p>
          </div>
          {user?.plan !== 'FREE' && (
            <Badge variant="green">Active</Badge>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan, i) => {
            const Icon = plan.icon
            const isCurrentPlan = user?.plan === plan.id
            const isUpgrade = plan.price > (PLANS.find(p => p.id === user?.plan)?.price ?? 0)

            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  'relative rounded-2xl border p-6 flex flex-col',
                  plan.recommended
                    ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                    : 'border-border bg-card'
                )}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3">Most Popular</Badge>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={cn('h-9 w-9 rounded-xl bg-secondary flex items-center justify-center', plan.recommended && 'bg-primary/10')}>
                    <Icon className={cn('h-5 w-5', plan.color)} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{plan.name}</h3>
                    <p className="text-2xl font-bold">
                      {plan.price === 0 ? 'Free' : `$${plan.price}`}
                      {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                    </p>
                  </div>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button variant="outline" disabled className="w-full">Current Plan</Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id)}
                    loading={loading === plan.id}
                    variant={plan.recommended ? 'default' : 'outline'}
                  >
                    Upgrade to {plan.name}
                  </Button>
                ) : (
                  <Button variant="ghost" disabled className="w-full text-muted-foreground">
                    Downgrade
                  </Button>
                )}
              </motion.div>
            )
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Payments processed securely by Stripe. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
