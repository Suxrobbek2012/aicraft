import type { FastifyInstance } from 'fastify'

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => {
    const dbOk = await app.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false)

    const redisOk = await app.redis
      .ping()
      .then((r) => r === 'PONG')
      .catch(() => false)

    const status = dbOk && redisOk ? 'ok' : 'degraded'

    reply.status(dbOk && redisOk ? 200 : 503).send({
      status,
      timestamp: new Date().toISOString(),
      services: { database: dbOk, redis: redisOk },
      version: '1.0.0',
    })
  })

  app.get('/ready', async (_req, reply) => {
    reply.send({ ready: true })
  })
}
