import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function notificationRoutes(app: FastifyInstance) {
  // GET /api/v1/notifications
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { page = 1, pageSize = 20, unreadOnly } = request.query as {
      page?: number
      pageSize?: number
      unreadOnly?: boolean
    }

    const skip = (Number(page) - 1) * Number(pageSize)

    const [notifications, total, unreadCount] = await Promise.all([
      app.prisma.notification.findMany({
        where: { userId: user.sub, ...(unreadOnly ? { isRead: false } : {}) },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(pageSize),
      }),
      app.prisma.notification.count({ where: { userId: user.sub } }),
      app.prisma.notification.count({ where: { userId: user.sub, isRead: false } }),
    ])

    return reply.send({
      success: true,
      data: notifications,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
        unreadCount,
      },
    })
  })

  // POST /api/v1/notifications/:id/read
  app.post('/:id/read', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }

    await app.prisma.notification.updateMany({
      where: { id, userId: user.sub },
      data: { isRead: true, readAt: new Date() },
    })

    return reply.send({ success: true, data: { message: 'Marked as read' } })
  })

  // POST /api/v1/notifications/read-all
  app.post('/read-all', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    await app.prisma.notification.updateMany({
      where: { userId: user.sub, isRead: false },
      data: { isRead: true, readAt: new Date() },
    })
    return reply.send({ success: true, data: { message: 'All notifications marked as read' } })
  })

  // DELETE /api/v1/notifications/:id
  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    await app.prisma.notification.deleteMany({ where: { id, userId: user.sub } })
    return reply.send({ success: true, data: { message: 'Notification deleted' } })
  })
}
