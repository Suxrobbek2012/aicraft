import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { Server as SocketIOServer } from 'socket.io'
import { config } from '../config'
import { logger } from '../lib/logger'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from './auth.plugin'

export const socketPlugin = fp(async (app: FastifyInstance) => {
  const io = new SocketIOServer(app.server, {
    cors: {
      origin: config.CORS_ORIGINS.split(',').map((o) => o.trim()),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // JWT auth middleware for Socket.IO
  io.use((socket, next) => {
    const token =
      socket.handshake.auth.token ??
      (socket.handshake.headers.authorization ?? '').replace('Bearer ', '')

    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload
      socket.data.userId = payload.sub
      socket.data.user = payload
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string
    logger.debug({ userId, socketId: socket.id }, 'Socket connected')

    // Join personal room
    socket.join(`user:${userId}`)

    socket.on('join:conversation', (conversationId: string) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('leave:conversation', (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`)
    })

    socket.on('join:workspace', (workspaceId: string) => {
      socket.join(`workspace:${workspaceId}`)
    })

    socket.on('disconnect', () => {
      logger.debug({ userId, socketId: socket.id }, 'Socket disconnected')
    })
  })

  app.decorate('io', io)
  app.addHook('onClose', async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()))
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    io: SocketIOServer
  }
}
