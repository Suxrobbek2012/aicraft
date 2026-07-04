import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createHash, randomBytes } from 'crypto'
import { maskApiKey } from '@go-ai/shared'
import { NotFoundError, ForbiddenError } from '../lib/errors'
import type { JwtPayload } from '../plugins/auth.plugin'

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z
    .array(
      z.enum([
        'chat_read',
        'chat_write',
        'files_read',
        'files_write',
        'models_read',
        'usage_read',
      ])
    )
    .min(1),
  rateLimit: z.number().int().min(1).max(1000).optional().default(60),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
})

export default async function apiKeyRoutes(app: FastifyInstance) {
  // GET /api/v1/api-keys
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const keys = await app.prisma.apiKey.findMany({
      where: { userId: user.sub, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        rateLimit: true,
        totalRequests: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: keys })
  })

  // POST /api/v1/api-keys
  app.post('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const input = CreateApiKeySchema.parse(request.body)

    // Check plan limits — PRO+ only
    if (user.plan === 'FREE') {
      throw new ForbiddenError('API access requires PRO plan or higher')
    }

    // Check max keys limit
    const count = await app.prisma.apiKey.count({ where: { userId: user.sub, isActive: true } })
    const maxKeys = user.plan === 'ULTRA' ? 20 : 5
    if (count >= maxKeys) {
      throw new ForbiddenError(`Maximum ${maxKeys} API keys allowed on your plan`)
    }

    const rawKey = `goai_${randomBytes(32).toString('hex')}`
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const keyPrefix = rawKey.slice(0, 12)

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined

    const key = await app.prisma.apiKey.create({
      data: {
        userId: user.sub,
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes as any,
        rateLimit: input.rateLimit,
        expiresAt,
      },
    })

    return reply.status(201).send({
      success: true,
      data: {
        id: key.id,
        name: key.name,
        key: rawKey, // Only returned once!
        keyPrefix,
        scopes: key.scopes,
        expiresAt: key.expiresAt,
        createdAt: key.createdAt,
      },
    })
  })

  // PATCH /api/v1/api-keys/:id
  app.patch('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    const { name } = request.body as { name?: string }

    const key = await app.prisma.apiKey.findFirst({ where: { id, userId: user.sub } })
    if (!key) throw new NotFoundError('API Key')

    const updated = await app.prisma.apiKey.update({
      where: { id },
      data: { name },
    })
    return reply.send({ success: true, data: { id: updated.id, name: updated.name } })
  })

  // DELETE /api/v1/api-keys/:id  — Revoke
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    const key = await app.prisma.apiKey.findFirst({ where: { id, userId: user.sub } })
    if (!key) throw new NotFoundError('API Key')

    await app.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    })

    return reply.send({ success: true, data: { message: 'API key revoked' } })
  })
}
