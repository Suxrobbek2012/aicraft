import OpenAI from 'openai'
import { OpenAIProvider } from './openai.provider'
import type { AIProvider } from '@go-ai/shared'

/**
 * xAI (Grok) uses an OpenAI-compatible API
 */
export class XAIProvider extends OpenAIProvider {
  override readonly provider: AIProvider = 'xai'
  override readonly name = 'xAI (Grok)'

  constructor(apiKey: string) {
    super(apiKey, undefined, 'https://api.x.ai/v1')
  }

  override async listModels(): Promise<string[]> {
    return ['grok-2', 'grok-2-mini', 'grok-beta']
  }
}
