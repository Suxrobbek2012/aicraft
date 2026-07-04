import type { FastifyInstance } from 'fastify'
import { cacheGet, cacheSet, CACHE_PREFIX } from '../lib/redis'
import type { JwtPayload } from '../plugins/auth.plugin'

const getLocalModelDisplayName = (modelId: string) => {
  const id = modelId.replace('ollama/', '')
  if (id.includes('llama3.2:1b')) return 'Aicraft Mini'
  // if (id.includes('llama3.2:3b')) return 'Aicraft'
  if (id.includes('llama3.2')) return 'Aicraft'
  if (id.includes('llama3.1')) return 'Aicraft Pro'
  if (id.includes('llama')) return 'Aicraft'
  return id
}

export default async function modelRoutes(app: FastifyInstance) {
  // GET /api/v1/models  — List all enabled models
  app.get('/', { preHandler: [app.optionalAuth] }, async (request, reply) => {
    const cacheKey = `${CACHE_PREFIX.MODELS}all`
    const cached = await cacheGet(cacheKey)
    if (cached) return reply.send({ success: true, data: cached })

    const models = await app.prisma.aIModelConfig.findMany({
      where: { isEnabled: true },
      orderBy: { order: 'asc' },
    })

    const normalizedModels = models.map((model) => ({
      ...model,
      name: model.provider === 'ollama' ? getLocalModelDisplayName(model.modelId) : model.name,
    }))

    // Get local aicraft models and merge
    try {
      const ollamaProvider = app.ai.get('ollama')
      const ollamaModels = await ollamaProvider.listModels()
      const allowedOllamaModels = ollamaModels.filter((m) => m.includes('llama3.2:1b'))
      const ollamaConfigs = allowedOllamaModels
        .filter((m) => !models.find((dbm) => dbm.modelId === m))
        .map((m) => ({
          id: undefined,
          modelId: m,
          name: getLocalModelDisplayName(m),
          provider: 'ollama',
          contextWindow: 131072,
          maxOutputTokens: 8192,
          supportsVision: false,
          supportsTools: false,
          supportsStreaming: true,
          inputPricePerMillion: 0,
          outputPricePerMillion: 0,
          isEnabled: true,
          isDefault: false,
          capabilities: ['chat', 'code'],
          description: 'Aicraft lokal modeli — bepul, tez',
          order: 100,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))

      const allModels = [...normalizedModels, ...ollamaConfigs]
      await cacheSet(cacheKey, allModels, 300)
      return reply.send({ success: true, data: allModels })
    } catch {
      await cacheSet(cacheKey, normalizedModels, 300)
      return reply.send({ success: true, data: normalizedModels })
    }
  })

  // GET /api/v1/models/providers  — List available providers
  app.get('/providers', { preHandler: [app.authenticate] }, async (request, reply) => {
    const availableProviders = await app.ai.getAvailableProviders()
    const allProviders = app.ai.list()

    const providerIds = allProviders.filter((p) => p === 'ollama')

    return reply.send({
      success: true,
      data: providerIds.map((p) => ({
        id: p,
        name: app.ai.get(p).name,
        isAvailable: availableProviders.includes(p),
      })),
    })
  })

  // GET /api/v1/models/:modelId
  app.get('/:modelId', async (request, reply) => {
    const { modelId } = request.params as { modelId: string }
    const model = await app.prisma.aIModelConfig.findUnique({
      where: { modelId },
    })
    if (!model) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Model not found' } })
    }
    return reply.send({ success: true, data: model })
  })
}
