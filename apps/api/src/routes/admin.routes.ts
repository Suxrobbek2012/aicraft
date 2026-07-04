import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { getAdminStats } from '../services/usage.service'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function adminRoutes(app: FastifyInstance) {
  const adminGuard = [app.authenticate, app.requireRole(['ADMIN', 'SUPER_ADMIN'])]

  // GET /api/v1/admin/stats
  app.get('/stats', { preHandler: adminGuard }, async (_request, reply) => {
    const stats = await getAdminStats(app.prisma)
    return reply.send({ success: true, data: stats })
  })

  // GET /api/v1/admin/users
  app.get('/users', { preHandler: adminGuard }, async (request, reply) => {
    const { page = 1, pageSize = 20, q, plan, status } = request.query as {
      page?: number
      pageSize?: number
      q?: string
      plan?: string
      status?: string
    }
    const skip = (Number(page) - 1) * Number(pageSize)

    const where: Record<string, unknown> = {}
    if (q) {
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { username: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ]
    }
    if (plan) where.plan = plan
    if (status) where.status = status

    const [users, total] = await Promise.all([
      app.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(pageSize),
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          status: true,
          plan: true,
          isEmailVerified: true,
          tokenBalance: true,
          totalTokensUsed: true,
          createdAt: true,
          lastActiveAt: true,
          subscription: { select: { status: true, currentPeriodEnd: true } },
        },
      }),
      app.prisma.user.count({ where }),
    ])

    return reply.send({
      success: true,
      data: users,
      meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    })
  })

  // PATCH /api/v1/admin/users/:id
  app.patch('/users/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const UpdateUserSchema = z.object({
      role: z.enum(['USER', 'ADMIN', 'SUPER_ADMIN']).optional(),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'DELETED', 'PENDING_VERIFICATION']).optional(),
      plan: z.enum(['FREE', 'PRO', 'ULTRA']).optional(),
      tokenBalance: z.number().int().min(0).optional(),
    })
    const input = UpdateUserSchema.parse(request.body)
    const user = await app.prisma.user.update({ where: { id }, data: input as any })
    return reply.send({ success: true, data: user })
  })

  // DELETE /api/v1/admin/users/:id
  app.delete('/users/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await app.prisma.user.update({
      where: { id },
      data: { status: 'DELETED' },
    })
    return reply.send({ success: true, data: { message: 'User suspended' } })
  })

  // GET /api/v1/admin/models
  app.get('/models', { preHandler: adminGuard }, async (_request, reply) => {
    const models = await app.prisma.aIModelConfig.findMany({ orderBy: { order: 'asc' } })
    return reply.send({ success: true, data: models })
  })

  // PATCH /api/v1/admin/models/:modelId
  app.patch('/models/:modelId', { preHandler: adminGuard }, async (request, reply) => {
    const { modelId } = request.params as { modelId: string }
    const UpdateModelSchema = z.object({
      isEnabled: z.boolean().optional(),
      isDefault: z.boolean().optional(),
      inputPricePerMillion: z.number().optional(),
      outputPricePerMillion: z.number().optional(),
      description: z.string().optional(),
    })
    const input = UpdateModelSchema.parse(request.body)
    const model = await app.prisma.aIModelConfig.update({
      where: { modelId },
      data: input,
    })
    return reply.send({ success: true, data: model })
  })

  // GET /api/v1/admin/system-config
  app.get('/system-config', { preHandler: adminGuard }, async (_request, reply) => {
    const configs = await app.prisma.systemConfig.findMany({ orderBy: { key: 'asc' } })
    return reply.send({ success: true, data: configs })
  })

  // PATCH /api/v1/admin/system-config/:key
  app.patch('/system-config/:key', { preHandler: adminGuard }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { key } = request.params as { key: string }
    const { value } = request.body as { value: string }

    const config = await app.prisma.systemConfig.upsert({
      where: { key },
      update: { value, updatedBy: user.sub },
      create: { key, value, updatedBy: user.sub },
    })
    return reply.send({ success: true, data: config })
  })

  // GET /api/v1/admin/audit-logs
  app.get('/audit-logs', { preHandler: adminGuard }, async (request, reply) => {
    const { page = 1, pageSize = 50 } = request.query as { page?: number; pageSize?: number }
    const skip = (Number(page) - 1) * Number(pageSize)
    const logs = await app.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(pageSize),
    })
    return reply.send({ success: true, data: logs })
  })

  // GET /api/v1/admin/usage
  app.get('/usage', { preHandler: adminGuard }, async (request, reply) => {
    const { days = 30 } = request.query as { days?: number }
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000)

    const records = await app.prisma.usageRecord.findMany({
      where: { createdAt: { gte: since } },
      select: { period: true, model: true, totalTokens: true, costUsd: true },
    })

    const byDay = records.reduce(
      (acc, r) => {
        if (!acc[r.period]) acc[r.period] = { tokens: 0, cost: 0, requests: 0 }
        acc[r.period].tokens += r.totalTokens
        acc[r.period].cost += r.costUsd
        acc[r.period].requests += 1
        return acc
      },
      {} as Record<string, { tokens: number; cost: number; requests: number }>
    )

    return reply.send({ success: true, data: { byDay } })
  })
}
