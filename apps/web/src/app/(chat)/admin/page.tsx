'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users, MessageSquare, TrendingUp, DollarSign,
  Activity, Cpu, Shield, BarChart3,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { useRouter } from 'next/navigation'
import { formatNumber } from '@/lib/utils'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

interface AdminStats {
  users: { total: number; activeToday: number; byPlan: Record<string, number> }
  messages: { total: number; thisMonth: number }
  revenue: { thisMonth: number }
  topModels: { model: string; messages: number; tokens: number }[]
}

const PLAN_COLORS = { FREE: '#6b7280', PRO: '#eab308', ULTRA: '#a855f7' }

export default function AdminPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [usageData, setUsageData] = useState<Record<string, { tokens: number; cost: number; requests: number }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      router.replace('/chat')
      return
    }
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const [statsRes, usageRes] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/usage', { params: { days: 30 } }),
      ])
      setStats(statsRes.data.data)
      setUsageData(usageRes.data.data.byDay ?? {})
    } catch { } finally { setLoading(false) }
  }

  const chartData = Object.entries(usageData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, d]) => ({
      date: date.slice(5),
      requests: d.requests,
      tokens: Math.round(d.tokens / 1000),
    }))

  const planData = stats
    ? Object.entries(stats.users.byPlan).map(([name, value]) => ({ name, value }))
    : []

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const statCards = [
    { label: 'Total Users', value: formatNumber(stats?.users.total ?? 0), icon: Users, sub: `${stats?.users.activeToday ?? 0} active today`, color: 'text-blue-400' },
    { label: 'Messages (month)', value: formatNumber(stats?.messages.thisMonth ?? 0), icon: MessageSquare, sub: `${formatNumber(stats?.messages.total ?? 0)} total`, color: 'text-green-400' },
    { label: 'Revenue (month)', value: `$${(stats?.revenue.thisMonth ?? 0).toFixed(2)}`, icon: DollarSign, sub: 'API costs', color: 'text-yellow-400' },
    { label: 'Top Model', value: stats?.topModels[0]?.model?.split('/').pop()?.split('-')[0] ?? 'N/A', icon: Cpu, sub: `${formatNumber(stats?.topModels[0]?.messages ?? 0)} messages`, color: 'text-purple-400' },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" /> Admin Dashboard
        </h1>
      </div>

      <div className="p-6 space-y-6 max-w-6xl">
        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card, i) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{card.label}</p>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </motion.div>
            )
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Usage chart */}
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Daily Requests (14 days)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#181818', border: '1px solid #2a2a2a', borderRadius: '12px' }}
                  labelStyle={{ color: '#f9fafb' }}
                />
                <Area type="monotone" dataKey="requests" stroke="#22c55e" fill="url(#colorRequests)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Plan distribution */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4">Users by Plan</h3>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={planData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                  {planData.map((entry) => (
                    <Cell key={entry.name} fill={PLAN_COLORS[entry.name as keyof typeof PLAN_COLORS] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#181818', border: '1px solid #2a2a2a', borderRadius: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center mt-2">
              {planData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="h-2 w-2 rounded-full" style={{ background: PLAN_COLORS[entry.name as keyof typeof PLAN_COLORS] ?? '#6b7280' }} />
                  {entry.name}: {entry.value}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top models */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> Top Models
          </h3>
          <div className="space-y-2">
            {(stats?.topModels ?? []).slice(0, 5).map((model, i) => (
              <div key={model.model} className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="flex-1 text-sm truncate">{model.model}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(model.messages)} msgs</span>
                <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (model.messages / (stats?.topModels[0]?.messages ?? 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
