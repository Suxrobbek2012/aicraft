import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { prisma, type PrismaClient } from '@go-ai/database'

export const prismaPlugin = fp(async (app: FastifyInstance) => {
  await prisma.$connect()
  app.decorate('prisma', prisma)
  app.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}
