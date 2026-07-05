import fp from 'fastify-plugin'
import type { FastifyInstance } from 'fastify'
import { ProviderRegistry, type ProviderConfig } from '@go-ai/ai-core'
import { config } from '../config'
import { groqKeyManager } from '../lib/groq-key-manager'

export const aiPlugin = fp(async (app: FastifyInstance) => {
  const providerConfig: ProviderConfig = {
    ollama: { baseUrl: config.OLLAMA_BASE_URL },
  }

  // Groq — faol key bilan ishga tushuramiz
  const activeKey = groqKeyManager.getCurrentKey()
  if (activeKey) {
    providerConfig.groq = { apiKey: activeKey }
  }

  const registry = new ProviderRegistry(providerConfig)
  app.decorate('ai', registry)

  const available = registry.list()
  app.log.info(`🤖 AI providers registered: ${available.join(', ')}`)

  if (activeKey) {
    const status = groqKeyManager.getStatus()
    app.log.info(`✅ Groq (Aicraft Cloud) connected — ${status.active}/${status.total} keys active`)
  }

  const ollamaOk = await registry.get('ollama').isAvailable().catch(() => false)
  if (ollamaOk) {
    const models = await registry.get('ollama').listModels().catch(() => [])
    app.log.info(`🟩 Ollama models: ${models.length > 0 ? models.join(', ') : 'none'}`)
  }
})

declare module 'fastify' {
  interface FastifyInstance {
    ai: ProviderRegistry
  }
}
