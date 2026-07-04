import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function memoryRoutes(app: FastifyInstance) {
  app.get('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const memories = await app.prisma.memory.findMany({
      where: { userId: user.sub },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    })
    return reply.send({ success: true, data: memories })
  })

  app.delete('/:id', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { id } = request.params as { id: string }
    await app.prisma.memory.deleteMany({ where: { id, userId: user.sub } })
    return reply.send({ success: true })
  })

  app.delete('/', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    await app.prisma.memory.deleteMany({ where: { userId: user.sub } })
    return reply.send({ success: true, data: { message: 'All memories cleared' } })
  })
}
