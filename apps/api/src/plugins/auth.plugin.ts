import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import jwt from '@fastify/jwt'
import { config } from '../config'
import { UnauthorizedError, ForbiddenError } from '../lib/errors'
import type { UserRole } from '@go-ai/shared'

export interface JwtPayload {
  sub: string
  email: string
  role: UserRole
  plan: string
  type: 'access' | 'refresh'
  iat: number
  exp: number
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_ACCESS_EXPIRES },
  })

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
      const payload = request.user as JwtPayload
      if (payload.type !== 'access') {
        throw new UnauthorizedError('Invalid token type')
      }
    } catch (err) {
      throw new UnauthorizedError('Authentication required')
    }
  })

  app.decorate('optionalAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch {
      // Silently ignore — user is unauthenticated
    }
  })

  app.decorate('requireRole', (roles: UserRole[]) => {
    return async (request: FastifyRequest, _reply: FastifyReply) => {
      const payload = request.user as JwtPayload
      if (!payload) throw new UnauthorizedError()
      if (!roles.includes(payload.role)) {
        throw new ForbiddenError('Insufficient permissions')
      }
    }
  })

  // API Key authentication
  app.decorate('authenticateApiKey', async (request: FastifyRequest, reply: FastifyReply) => {
    const apiKey = request.headers['x-api-key'] as string | undefined
    if (!apiKey) throw new UnauthorizedError('API key required')

    const { createHash } = await import('crypto')
    const keyHash = createHash('sha256').update(apiKey).digest('hex')

    const key = await app.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: { select: { id: true, email: true, role: true, plan: true, status: true } } },
    })

    if (!key || !key.isActive) throw new UnauthorizedError('Invalid or inactive API key')
    if (key.expiresAt && key.expiresAt < new Date()) throw new UnauthorizedError('API key expired')
    if (key.user.status !== 'ACTIVE') throw new ForbiddenError('Account suspended')

    // Update usage
    await app.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date(), totalRequests: { increment: 1 } },
    })

    // Inject user-like JWT payload for downstream handlers
    ;(request as FastifyRequest & { user: JwtPayload }).user = {
      sub: key.user.id,
      email: key.user.email,
      role: key.user.role as UserRole,
      plan: key.user.plan,
      type: 'access',
      iat: Date.now(),
      exp: Date.now() + 3600000,
    }

    ;(request as FastifyRequest & { apiKeyId: string }).apiKeyId = key.id
    ;(request as FastifyRequest & { apiKeyScopes: string[] }).apiKeyScopes = key.scopes
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, rep: FastifyReply) => Promise<void>
    optionalAuth: (req: FastifyRequest, rep: FastifyReply) => Promise<void>
    authenticateApiKey: (req: FastifyRequest, rep: FastifyReply) => Promise<void>
    requireRole: (roles: UserRole[]) => (req: FastifyRequest, rep: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}
