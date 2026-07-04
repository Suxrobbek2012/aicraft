import { OpenAIProvider } from './openai.provider'
import type { AIProvider } from '@go-ai/shared'

/**
 * Perplexity uses an OpenAI-compatible API
 */
export class PerplexityProvider extends OpenAIProvider {
  override readonly provider: AIProvider = 'perplexity'
  override readonly name = 'Perplexity'

  constructor(apiKey: string) {
    super(apiKey, undefined, 'https://api.perplexity.ai')
  }

  override async listModels(): Promise<string[]> {
    return [
      'llama-3.1-sonar-small-128k-online',
      'llama-3.1-sonar-large-128k-online',
      'llama-3.1-sonar-huge-128k-online',
    ]
  }
}
