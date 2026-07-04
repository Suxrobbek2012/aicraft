import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { cacheDel, CACHE_PREFIX } from '../lib/redis'
import { NotFoundError } from '../lib/errors'
import type { JwtPayload } from '../plugins/auth.plugin'
import { PLAN_LIMITS } from '@go-ai/shared'
import { getUserUsageStats } from '../services/usage.service'

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  website: z.string().url().optional().nullable(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
})

const UpdateSettingsSchema = z.object({
  theme: z.enum(['dark', 'light', 'system']).optional(),
  language: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultProvider: z.string().optional(),
  streamResponses: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  autoTitle: z.boolean().optional(),
  compactMode: z.boolean().optional(),
  codeTheme: z.string().optional(),
  fontSize: z.enum(['sm', 'md', 'lg']).optional(),
  sendOnEnter: z.boolean().optional(),
  showTokenCount: z.boolean().optional(),
  ttsEnabled: z.boolean().optional(),
  ttsVoice: z.string().optional(),
  ttsSpeed: z.number().min(0.25).max(4).optional(),
  sttEnabled: z.boolean().optional(),
  memoryEnabled: z.boolean().optional(),
})

export default async function userRoutes(app: FastifyInstance) {
  // GET /api/v1/users/me
  app.get('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const fullUser = await app.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        status: true,
        plan: true,
        isEmailVerified: true,
        twoFactorEnabled: true,
        tokenBalance: true,
        totalTokensUsed: true,
        language: true,
        timezone: true,
        bio: true,
        location: true,
        website: true,
        lastActiveAt: true,
        createdAt: true,
        settings: true,
        subscription: true,
      },
    })
    if (!fullUser) throw new NotFoundError('User')

    const usageStats = await getUserUsageStats(app.prisma, fullUser.id, 'month')
    const planLimits = PLAN_LIMITS[fullUser.plan as keyof typeof PLAN_LIMITS]
    const monthlyTokensUsed = usageStats.totalTokens
    const monthlyTokensRemaining = Math.max(0, planLimits.monthlyTokens - monthlyTokensUsed)

    return reply.send({
      success: true,
      data: {
        ...fullUser,
        monthlyTokensUsed,
        monthlyTokensRemaining,
      },
    })
  })

  // PATCH /api/v1/users/me
  app.patch('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const input = UpdateProfileSchema.parse(request.body)

    const updated = await app.prisma.user.update({
      where: { id: user.sub },
      data: {
        displayName: input.displayName,
        bio: input.bio,
        location: input.location,
        website: input.website,
        language: input.language,
        timezone: input.timezone,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        location: true,
        website: true,
        language: true,
        timezone: true,
      },
    })

    await cacheDel(`${CACHE_PREFIX.USER}${user.sub}`)
    return reply.send({ success: true, data: updated })
  })

  // GET /api/v1/users/me/settings
  app.get('/me/settings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const settings = await app.prisma.userSettings.findUnique({
      where: { userId: user.sub },
    })
    return reply.send({ success: true, data: settings })
  })

  // PATCH /api/v1/users/me/settings
  app.patch('/me/settings', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const input = UpdateSettingsSchema.parse(request.body)

    const settings = await app.prisma.userSettings.upsert({
      where: { userId: user.sub },
      update: input,
      create: { userId: user.sub, ...input },
    })

    await cacheDel(`${CACHE_PREFIX.SETTINGS}${user.sub}`)
    return reply.send({ success: true, data: settings })
  })

  // POST /api/v1/users/me/avatar
  app.post('/me/avatar', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const parts = request.parts()

    for await (const part of parts) {
      if (part.type !== 'file') continue

      if (!part.mimetype.startsWith('image/')) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Only images allowed' } })
      }

      const buffer = await part.toBuffer()
      if (buffer.length > 5 * 1024 * 1024) {
        return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Avatar must be under 5MB' } })
      }

      // Resize with sharp
      const sharp = (await import('sharp')).default
      const resized = await sharp(buffer)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 85 })
        .toBuffer()

      const storageKey = `avatars/${user.sub}.webp`
      const publicUrl = await app.storage.upload(storageKey, resized, 'image/webp')

      await app.prisma.user.update({
        where: { id: user.sub },
        data: { avatarUrl: publicUrl },
      })

      await cacheDel(`${CACHE_PREFIX.USER}${user.sub}`)
      return reply.send({ success: true, data: { avatarUrl: publicUrl } })
    }

    return reply.status(400).send({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' } })
  })

  // GET /api/v1/users/me/usage
  app.get('/me/usage', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { period = 'month' } = request.query as { period?: 'day' | 'month' | 'all' }
    const stats = await getUserUsageStats(app.prisma, user.sub, period)
    return reply.send({ success: true, data: stats })
  })

  // DELETE /api/v1/users/me  — Account deletion
  app.delete('/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { password } = request.body as { password: string }

    const dbUser = await app.prisma.user.findUnique({
      where: { id: user.sub },
      select: { passwordHash: true },
    })
    if (!dbUser?.passwordHash) throw new NotFoundError('User')

    const bcrypt = await import('bcryptjs')
    const match = await bcrypt.compare(password, dbUser.passwordHash)
    if (!match) {
      return reply.status(403).send({ success: false, error: { code: 'FORBIDDEN', message: 'Incorrect password' } })
    }

    await app.prisma.user.update({
      where: { id: user.sub },
      data: { status: 'DELETED', email: `deleted_${user.sub}@deleted.invalid` },
    })

    return reply.send({ success: true, data: { message: 'Account deleted' } })
  })

  // GET /api/v1/users/me/memories
  app.get('/me/memories', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { page = 1, pageSize = 20 } = request.query as { page?: number; pageSize?: number }
    const skip = (Number(page) - 1) * Number(pageSize)

    const [memories, total] = await Promise.all([
      app.prisma.memory.findMany({
        where: { userId: user.sub },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: Number(pageSize),
      }),
      app.prisma.memory.count({ where: { userId: user.sub } }),
    ])

    return reply.send({
      success: true,
      data: memories,
      meta: { page: Number(page), pageSize: Number(pageSize), total, totalPages: Math.ceil(total / Number(pageSize)) },
    })
  })

  // DELETE /api/v1/users/me/memories/:id
  app.delete('/me/memories/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    await app.prisma.memory.deleteMany({ where: { id, userId: user.sub } })
    return reply.send({ success: true, data: { message: 'Memory deleted' } })
  })

  // DELETE /api/v1/users/me/memories  — Clear all
  app.delete('/me/memories', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { count } = await app.prisma.memory.deleteMany({ where: { userId: user.sub } })
    return reply.send({ success: true, data: { message: `${count} memories cleared` } })
  })
}
