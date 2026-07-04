import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { ProviderRegistry, type ProviderConfig } from '@go-ai/ai-core'
import { config } from '../config'

export const aiPlugin = fp(async (app: FastifyInstance) => {
  // Only Ollama is used — no external API keys needed
  const providerConfig: ProviderConfig = {
    ollama: { baseUrl: config.OLLAMA_BASE_URL },
  }

  // Only use Ollama locally. Ignore external providers in this deployment.
  const registry = new ProviderRegistry(providerConfig)
  app.decorate('ai', registry)

  const available = registry.list()
  app.log.info(`🤖 AI providers registered: ${available.join(', ')}`)

  const ollamaOk = await registry.get('ollama').isAvailable().catch(() => false)
  if (ollamaOk) {
    const models = await registry.get('ollama').listModels().catch(() => [])
    app.log.info(`🟩 aicraft local models: ${models.length > 0 ? models.join(', ') : 'none (run: ollama pull llama3.2:1b)'}`)
  } else {
    app.log.warn('⚠️  Local aicraft model service is not running. Start it with: ollama serve')
  }
})

declare module 'fastify' {
  interface FastifyInstance {
    ai: ProviderRegistry
  }
}
