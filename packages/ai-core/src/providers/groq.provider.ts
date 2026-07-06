import OpenAI from 'openai'
import { BaseAIProvider } from './base.provider'
import type {
  AIRequestOptions,
  AIResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIMessage,
  AIProvider,
} from '@go-ai/shared'

export class GroqProvider extends BaseAIProvider {
  readonly provider: AIProvider = 'groq' as AIProvider
  readonly name: string = 'Aicraft'

  private client: OpenAI

  constructor(apiKey: string) {
    super()
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 3,
      timeout: 60_000,
    })
  }

  /** Key rotation uchun — yangi API key bilan client qayta yaratish */
  setApiKey(apiKey: string): void {
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
      maxRetries: 3,
      timeout: 60_000,
    })
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list()
      return true
    } catch {
      return false
    }
  }

  private buildMessages(messages: AIMessage[]): OpenAI.ChatCompletionMessageParam[] {
    return messages.map((msg) => {
      if (msg.role === 'system') return { role: 'system', content: msg.content as string }
      if (msg.role === 'assistant') {
        return { role: 'assistant', content: typeof msg.content === 'string' ? msg.content : '' }
      }
      if (typeof msg.content === 'string') return { role: 'user', content: msg.content }
      // multipart — groq only supports text parts
      const text = (msg.content as Array<{ type: string; text?: string }>)
        .filter((p) => p.type === 'text')
        .map((p) => p.text ?? '')
        .join('\n')
      return { role: 'user', content: text }
    })
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const start = Date.now()
    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt })
    messages.push(...this.buildMessages(options.messages))

    const response = await this.client.chat.completions.create({
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    })
    const choice = response.choices[0]
    return {
      id: response.id,
      model: response.model,
      provider: 'groq' as AIProvider,
      content: choice.message.content ?? '',
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: (choice.finish_reason as AIResponse['finishReason']) ?? 'stop',
      latencyMs: Date.now() - start,
    }
  }

  async *chatStream(options: AIRequestOptions): AsyncGenerator<AIStreamChunk, void, unknown> {
    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt })
    messages.push(...this.buildMessages(options.messages))

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
    })

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      if (!choice) continue
      if (choice.delta?.content) {
        yield { type: 'delta', delta: choice.delta.content }
      }
      if (choice.finish_reason) {
        yield {
          type: 'done',
          finishReason: choice.finish_reason,
          usage: (chunk as any).usage ? {
            inputTokens: (chunk as any).usage.prompt_tokens ?? 0,
            outputTokens: (chunk as any).usage.completion_tokens ?? 0,
            totalTokens: (chunk as any).usage.total_tokens ?? 0,
          } : undefined,
        }
      }
    }
  }

  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Groq doesn't support embeddings yet
    return { embeddings: [], model: 'none', usage: { totalTokens: 0 } }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list()
      return models.data.map((m) => m.id)
    } catch {
      return ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'gemma2-9b-it']
    }
  }
}
