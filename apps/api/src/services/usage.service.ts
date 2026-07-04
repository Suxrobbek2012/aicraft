import type { PrismaClient } from '@go-ai/database'
import { logger } from '../lib/logger'
import dayjs from 'dayjs'

interface TrackUsageParams {
  userId: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  conversationId?: string
  messageId?: string
}

export async function trackUsage(prisma: PrismaClient, params: TrackUsageParams): Promise<void> {
  const { userId, model, provider, inputTokens, outputTokens, costUsd } = params
  const today = dayjs().format('YYYY-MM-DD')

  try {
    await Promise.all([
      // Record usage entry
      prisma.usageRecord.create({
        data: {
          userId,
          conversationId: params.conversationId,
          messageId: params.messageId,
          model,
          provider,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          costUsd,
          period: today,
        },
      }),
      // Update user total tokens used
      prisma.user.update({
        where: { id: userId },
        data: {
          totalTokensUsed: { increment: inputTokens + outputTokens },
        },
      }),
      // Deduct from token balance (internal economy)
      prisma.user.update({
        where: { id: userId },
        data: {
          tokenBalance: {
            decrement: Math.ceil((inputTokens + outputTokens) * 0.001),
          },
        },
      }),
    ])
  } catch (err) {
    logger.error({ err, userId }, 'Usage tracking failed')
  }
}

export async function getUserUsageStats(
  prisma: PrismaClient,
  userId: string,
  period: 'day' | 'month' | 'all' = 'month'
) {
  const now = dayjs()
  let startDate: Date

  if (period === 'day') {
    startDate = now.startOf('day').toDate()
  } else if (period === 'month') {
    startDate = now.startOf('month').toDate()
  } else {
    startDate = new Date(0)
  }

  const records = await prisma.usageRecord.findMany({
    where: { userId, createdAt: { gte: startDate } },
    select: {
      model: true,
      provider: true,
      inputTokens: true,
      outputTokens: true,
      totalTokens: true,
      costUsd: true,
      createdAt: true,
    },
  })

  const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0)
  const totalCost = records.reduce((sum, r) => sum + r.costUsd, 0)
  const totalMessages = records.length

  // Group by model
  const byModel = records.reduce(
    (acc, r) => {
      const key = r.model
      if (!acc[key]) acc[key] = { tokens: 0, cost: 0, messages: 0 }
      acc[key].tokens += r.totalTokens
      acc[key].cost += r.costUsd
      acc[key].messages += 1
      return acc
    },
    {} as Record<string, { tokens: number; cost: number; messages: number }>
  )

  // Daily breakdown
  const byDay = records.reduce(
    (acc, r) => {
      const day = dayjs(r.createdAt).format('YYYY-MM-DD')
      if (!acc[day]) acc[day] = { tokens: 0, cost: 0, messages: 0 }
      acc[day].tokens += r.totalTokens
      acc[day].cost += r.costUsd
      acc[day].messages += 1
      return acc
    },
    {} as Record<string, { tokens: number; cost: number; messages: number }>
  )

  return {
    totalTokens,
    totalCost,
    totalMessages,
    byModel,
    byDay,
  }
}

export async function getAdminStats(prisma: PrismaClient) {
  const now = dayjs()
  const today = now.format('YYYY-MM-DD')
  const monthStart = now.startOf('month').toDate()

  const [
    totalUsers,
    activeToday,
    totalMessages,
    monthMessages,
    planCounts,
    totalRevenue,
    topModels,
  ] = await Promise.all([
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.user.count({
      where: { lastActiveAt: { gte: now.startOf('day').toDate() } },
    }),
    prisma.message.count({ where: { role: 'user' } }),
    prisma.message.count({
      where: { role: 'user', createdAt: { gte: monthStart } },
    }),
    prisma.user.groupBy({ by: ['plan'], _count: true }),
    prisma.usageRecord.aggregate({
      _sum: { costUsd: true },
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.usageRecord.groupBy({
      by: ['model'],
      _count: true,
      _sum: { totalTokens: true },
      orderBy: { _count: { model: 'desc' } },
      take: 10,
    }),
  ])

  return {
    users: {
      total: totalUsers,
      activeToday,
      byPlan: planCounts.reduce(
        (acc, p) => {
          acc[p.plan] = p._count
          return acc
        },
        {} as Record<string, number>
      ),
    },
    messages: { total: totalMessages, thisMonth: monthMessages },
    revenue: { thisMonth: totalRevenue._sum.costUsd ?? 0 },
    topModels: topModels.map((m) => ({
      model: m.model,
      messages: m._count,
      tokens: m._sum.totalTokens ?? 0,
    })),
  }
}
