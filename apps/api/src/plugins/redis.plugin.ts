import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { getRedis } from '../lib/redis'

export const redisPlugin = fp(async (app: FastifyInstance) => {
  const redis = getRedis()
  await redis.connect().catch(() => {
    // Already connected or connecting - ignore
  })
  app.decorate('redis', redis)
  app.addHook('onClose', async () => {
    await redis.quit()
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    redis: ReturnType<typeof getRedis>
  }
}
