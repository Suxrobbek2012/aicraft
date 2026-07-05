import type { AIProvider } from '@go-ai/shared'
import { BaseAIProvider } from './providers/base.provider'
import { OpenAIProvider } from './providers/openai.provider'
import { AnthropicProvider } from './providers/anthropic.provider'
import { GoogleProvider } from './providers/google.provider'
import { OllamaProvider } from './providers/ollama.provider'
import { XAIProvider } from './providers/xai.provider'
import { PerplexityProvider } from './providers/perplexity.provider'
import { GroqProvider } from './providers/groq.provider'

export interface ProviderConfig {
  openai?: { apiKey: string; orgId?: string }
  anthropic?: { apiKey: string }
  google?: { apiKey: string }
  xai?: { apiKey: string }
  perplexity?: { apiKey: string }
  ollama?: { baseUrl?: string }
  groq?: { apiKey: string }
}

export class ProviderRegistry {
  private providers = new Map<AIProvider, BaseAIProvider>()
  private ollamaBaseUrl: string

  constructor(config: ProviderConfig) {
    this.ollamaBaseUrl = config.ollama?.baseUrl ?? process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

    if (config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(config.openai.apiKey, config.openai.orgId))
    }
    if (config.anthropic?.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(config.anthropic.apiKey))
    }
    if (config.google?.apiKey) {
      this.providers.set('google', new GoogleProvider(config.google.apiKey))
    }
    if (config.xai?.apiKey) {
      this.providers.set('xai', new XAIProvider(config.xai.apiKey))
    }
    if (config.perplexity?.apiKey) {
      this.providers.set('perplexity', new PerplexityProvider(config.perplexity.apiKey))
    }
    if (config.groq?.apiKey) {
      this.providers.set('groq' as AIProvider, new GroqProvider(config.groq.apiKey))
    }

    // Ollama is always registered as a local fallback
    this.providers.set('ollama', new OllamaProvider(this.ollamaBaseUrl))
  }

  get(provider: AIProvider): BaseAIProvider {
    const p = this.providers.get(provider)
    if (!p) {
      throw new Error(`Provider "${provider}" is not configured`)
    }
    return p
  }

  has(provider: AIProvider): boolean {
    return this.providers.has(provider)
  }

  list(): AIProvider[] {
    return Array.from(this.providers.keys())
  }

  /**
   * Get the first available provider, falling back to Ollama if nothing else is configured
   */
  async getPreferred(preferredProvider?: AIProvider): Promise<BaseAIProvider> {
    if (preferredProvider && this.providers.has(preferredProvider)) {
      return this.providers.get(preferredProvider)!
    }

    // Try providers in preference order
    const order: AIProvider[] = ['openai', 'anthropic', 'google', 'xai', 'perplexity', 'ollama']
    for (const name of order) {
      const p = this.providers.get(name)
      if (p) {
        const available = await p.isAvailable().catch(() => false)
        if (available) return p
      }
    }

    // Last resort: Ollama
    const ollama = this.providers.get('ollama')!
    return ollama
  }

  async getAvailableProviders(): Promise<AIProvider[]> {
    const results: AIProvider[] = []
    for (const [name, provider] of this.providers.entries()) {
      const available = await provider.isAvailable().catch(() => false)
      if (available) results.push(name)
    }
    return results
  }
}
