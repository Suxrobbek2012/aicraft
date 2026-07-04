import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import multipart from '@fastify/multipart'
import { config } from './config'
import { logger } from './lib/logger'

// Plugins
import { redisPlugin } from './plugins/redis.plugin'
import { prismaPlugin } from './plugins/prisma.plugin'
import { aiPlugin } from './plugins/ai.plugin'
import { authPlugin } from './plugins/auth.plugin'
import { bullmqPlugin } from './plugins/bullmq.plugin'
import { storagePlugin } from './plugins/storage.plugin'
import { socketPlugin } from './plugins/socket.plugin'

// Routes
import authRoutes from './routes/auth.routes'
import userRoutes from './routes/user.routes'
import chatRoutes from './routes/chat.routes'
import conversationRoutes from './routes/conversation.routes'
import fileRoutes from './routes/file.routes'
import modelRoutes from './routes/model.routes'
import workspaceRoutes from './routes/workspace.routes'
import apiKeyRoutes from './routes/apikey.routes'
import adminRoutes from './routes/admin.routes'
import subscriptionRoutes from './routes/subscription.routes'
import notificationRoutes from './routes/notification.routes'
import memoryRoutes from './routes/memory.routes'
import pluginRoutes from './routes/plugin.routes'
import webhookRoutes from './routes/webhook.routes'
import healthRoutes from './routes/health.routes'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: logger as unknown as boolean,
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10MB for JSON
    ajv: {
      customOptions: {
        removeAdditional: 'all',
        coerceTypes: true,
        allErrors: true,
      },
    },
  })

  // ─── Core Plugins ────────────────────────────────────────────────────────────

  // CORS MUST be registered before routes
  await app.register(cors, {
    origin: [config.CORS_ORIGINS].flatMap((v) => v.split(',')).map((s) => s.trim()).filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
    preflight: true,
    // Ensure OPTIONS returns headers even if no route matches
    optionsSuccessStatus: 204,
  })


  await app.register(helmet, {
    contentSecurityPolicy: false, // handled by NGINX in prod
    crossOriginEmbedderPolicy: false,
  })


  await app.register(cookie, {
    secret: config.JWT_SECRET,

    parseOptions: { httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production' },
  })

  await app.register(multipart, {
    limits: {
      fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 20,
    },
  })

  // ─── API Docs ────────────────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'aicraft API',
        description: 'Production-ready AI SaaS Platform API',
        version: '1.0.0',
      },
      servers: [{ url: config.API_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
        },
      },
      tags: [
        { name: 'auth', description: 'Authentication' },
        { name: 'users', description: 'User management' },
        { name: 'chat', description: 'AI chat' },
        { name: 'conversations', description: 'Conversation management' },
        { name: 'files', description: 'File upload & processing' },
        { name: 'models', description: 'AI models' },
        { name: 'workspaces', description: 'Workspace management' },
        { name: 'api-keys', description: 'API key management' },
        { name: 'subscriptions', description: 'Billing & subscriptions' },
        { name: 'admin', description: 'Admin dashboard' },
      ],
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  })

  // ─── Rate Limiting ────────────────────────────────────────────────────────────
  await app.register(rateLimit, {
    global: false, // Apply per-route
    redis: undefined, // Will be set after redis plugin
  })

  // ─── Application Plugins ──────────────────────────────────────────────────────
  await app.register(redisPlugin)
  await app.register(prismaPlugin)
  await app.register(aiPlugin)
  await app.register(authPlugin)
  await app.register(storagePlugin)
  await app.register(bullmqPlugin)
  await app.register(socketPlugin)

  // ─── Routes ───────────────────────────────────────────────────────────────────
  await app.register(healthRoutes, { prefix: '/health' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(userRoutes, { prefix: '/api/v1/users' })
  await app.register(chatRoutes, { prefix: '/api/v1/chat' })
  await app.register(conversationRoutes, { prefix: '/api/v1/conversations' })
  await app.register(fileRoutes, { prefix: '/api/v1/files' })
  await app.register(modelRoutes, { prefix: '/api/v1/models' })
  await app.register(workspaceRoutes, { prefix: '/api/v1/workspaces' })
  await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' })
  await app.register(subscriptionRoutes, { prefix: '/api/v1/subscriptions' })
  await app.register(notificationRoutes, { prefix: '/api/v1/notifications' })
  await app.register(memoryRoutes, { prefix: '/api/v1/memories' })
  await app.register(pluginRoutes, { prefix: '/api/v1/plugins' })
  await app.register(adminRoutes, { prefix: '/api/v1/admin' })

  // ─── Error Handler ────────────────────────────────────────────────────────────
  app.setErrorHandler(async (error, request, reply) => {
    // Handle Zod validation errors as 400
    // ZodError can appear directly or wrapped by Fastify (message is a JSON string)
    const isZodDirect = error.name === 'ZodError' || (error as any).issues != null
    const isZodWrapped = (() => {
      try {
        const parsed = JSON.parse(error.message)
        return Array.isArray(parsed) && parsed[0]?.code != null
      } catch {
        return false
      }
    })()

    if (isZodDirect || isZodWrapped) {
      let issues: any[] = (error as any).issues ?? []
      if (!issues.length) {
        try { issues = JSON.parse(error.message) } catch {}
      }
      const firstIssue = issues[0]
      const message = firstIssue?.message ?? 'Validation error'
      reply.status(400)
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message,
          details: issues,
        },
      }
    }

    const statusCode = error.statusCode ?? 500

    if (statusCode >= 500) {
      app.log.error({ err: error, req: request.id }, 'Unhandled error')
    }

    let message: string
    try {
      // Fastify/JSON serialization can fail for BigInt inside Prisma payloads.
      // Normalize to string so the error handler never throws.
      const raw: unknown = (error as any)?.message
      if (typeof raw === 'bigint') {
        message = raw.toString()
      } else if (typeof raw === 'string') {
        message = raw
      } else {
        message = String(error)
      }
    } catch {
      message = 'Internal server error'
    }

    reply.status(statusCode).send({
      success: false,
      error: {
        code: (error as { code?: string }).code ?? 'INTERNAL_ERROR',
        message: statusCode >= 500 && config.NODE_ENV === 'production'
          ? 'Internal server error'
          : message,
        requestId: request.id,
      },
    })
  })

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method} ${request.url} not found`,
      },
    })
  })

  return app
}
