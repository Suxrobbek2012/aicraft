import type { FastifyInstance } from 'fastify'
import type { JwtPayload } from '../plugins/auth.plugin'

export default async function pluginRoutes(app: FastifyInstance) {
  // GET /api/v1/plugins  — List available plugins
  app.get('/', { preHandler: [app.optionalAuth] }, async (_request, reply) => {
    const plugins = await app.prisma.plugin.findMany({
      where: { isEnabled: true },
      orderBy: { installs: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        version: true,
        author: true,
        iconUrl: true,
        isOfficial: true,
        installs: true,
        manifest: true,
      },
    })
    return reply.send({ success: true, data: plugins })
  })

  // GET /api/v1/plugins/installed  — User installed plugins
  app.get('/installed', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const installs = await app.prisma.pluginInstall.findMany({
      where: { userId: user.sub, isEnabled: true },
      include: { plugin: true },
    })
    return reply.send({ success: true, data: installs })
  })

  // POST /api/v1/plugins/:slug/install
  app.post('/:slug/install', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { slug } = request.params as { slug: string }

    if (user.plan === 'FREE') {
      return reply.status(403).send({
        success: false,
        error: { code: 'FEATURE_NOT_AVAILABLE', message: 'Plugins require PRO plan' },
      })
    }

    const plugin = await app.prisma.plugin.findUnique({ where: { slug } })
    if (!plugin) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Plugin not found' } })
    }

    const install = await app.prisma.pluginInstall.upsert({
      where: { userId_pluginId: { userId: user.sub, pluginId: plugin.id } },
      update: { isEnabled: true },
      create: { userId: user.sub, pluginId: plugin.id },
    })

    await app.prisma.plugin.update({
      where: { id: plugin.id },
      data: { installs: { increment: 1 } },
    })

    return reply.send({ success: true, data: install })
  })

  // DELETE /api/v1/plugins/:slug/uninstall
  app.delete('/:slug/uninstall', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload
    const { slug } = request.params as { slug: string }

    const plugin = await app.prisma.plugin.findUnique({ where: { slug } })
    if (!plugin) return reply.status(404).send({ success: false })

    await app.prisma.pluginInstall.updateMany({
      where: { userId: user.sub, pluginId: plugin.id },
      data: { isEnabled: false },
    })

    return reply.send({ success: true })
  })
}
