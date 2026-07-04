import axios, { type AxiosInstance } from 'axios'
import { BaseAIProvider } from './base.provider'
import type {
  AIRequestOptions,
  AIResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIMessage,
} from '@go-ai/shared'

interface OllamaMessage {
  role: string
  content: string
  images?: string[]
}

interface OllamaResponse {
  model: string
  created_at: string
  message: { role: string; content: string }
  done: boolean
  total_duration?: number
  eval_count?: number
  prompt_eval_count?: number
}

export class OllamaProvider extends BaseAIProvider {
  readonly provider = 'ollama' as const
  readonly name = 'aicraft local'

  private http: AxiosInstance
  private baseUrl: string

  constructor(baseUrl = 'http://localhost:11434') {
    super()
    this.baseUrl = baseUrl
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 180_000,
    })
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.http.get('/api/tags', { timeout: 5000 })
      return res.status === 200
    } catch {
      return false
    }
  }

  private normalizeModelId(modelId: string): string {
    // Strip "ollama/" prefix if present
    return modelId.replace(/^ollama\//, '')
  }

  private buildMessages(messages: AIMessage[]): OllamaMessage[] {
    return messages.map((msg) => {
      const base: OllamaMessage = {
        role: msg.role === 'assistant' ? 'assistant' : msg.role === 'system' ? 'system' : 'user',
        content: typeof msg.content === 'string' ? msg.content : '',
      }

      // Extract image data from multipart messages
      if (Array.isArray(msg.content)) {
        const parts = msg.content as Array<{
          type: string
          text?: string
          image_url?: { url: string }
        }>
        const texts = parts.filter((p) => p.type === 'text').map((p) => p.text ?? '')
        const images = parts
          .filter((p) => p.type === 'image_url')
          .map((p) => {
            const url = p.image_url?.url ?? ''
            if (url.startsWith('data:')) {
              return url.split(',')[1]
            }
            return url
          })
        base.content = texts.join('\n')
        if (images.length) base.images = images
      }

      return base
    })
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const start = Date.now()
    const model = this.normalizeModelId(options.model)

    const messages: OllamaMessage[] = []
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push(...this.buildMessages(options.messages))

    const response = await this.http.post<OllamaResponse>('/api/chat', {
      model,
      messages,
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        num_predict: options.maxTokens ?? 4096,
      },
    })

    const data = response.data
    const latencyMs = Date.now() - start

    return {
      id: `ollama-${Date.now()}`,
      model,
      provider: 'ollama',
      content: data.message.content,
      usage: {
        inputTokens: data.prompt_eval_count ?? 0,
        outputTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      finishReason: 'stop',
      latencyMs,
    }
  }

  async *chatStream(options: AIRequestOptions): AsyncGenerator<AIStreamChunk, void, unknown> {
    const model = this.normalizeModelId(options.model)

    const messages: OllamaMessage[] = []
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push(...this.buildMessages(options.messages))

    const response = await this.http.post(
      '/api/chat',
      {
        model,
        messages,
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
      },
      { responseType: 'stream' }
    )

    let inputTokens = 0
    let outputTokens = 0

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const data: OllamaResponse = JSON.parse(line)
          if (data.message?.content) {
            yield { type: 'delta', delta: data.message.content }
          }
          if (data.done) {
            inputTokens = data.prompt_eval_count ?? 0
            outputTokens = data.eval_count ?? 0
            yield {
              type: 'done',
              finishReason: 'stop',
              usage: {
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
              },
            }
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = this.normalizeModelId(request.model ?? 'nomic-embed-text')
    const texts = Array.isArray(request.text) ? request.text : [request.text]
    const embeddings: number[][] = []

    for (const prompt of texts) {
      const res = await this.http.post('/api/embeddings', { model, prompt })
      embeddings.push(res.data.embedding)
    }

    return { embeddings, model, usage: { totalTokens: 0 } }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await this.http.get('/api/tags')
      return (res.data.models ?? []).map(
        (m: { name: string }) => `ollama/${m.name}`
      )
    } catch {
      return []
    }
  }
}
