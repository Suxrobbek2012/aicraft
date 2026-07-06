import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  type Content,
  type Part,
} from '@google/generative-ai'
import { BaseAIProvider } from './base.provider'
import type {
  AIRequestOptions,
  AIResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIMessage,
} from '@go-ai/shared'

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
]

export class GoogleProvider extends BaseAIProvider {
  readonly provider = 'google' as const
  readonly name = 'Google'

  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    super()
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async isAvailable(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: 'gemini-1.5-flash' })
      await model.generateContent('test')
      return true
    } catch {
      return false
    }
  }

  private buildGoogleMessages(messages: AIMessage[]): Content[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((msg) => {
        const role = msg.role === 'assistant' ? 'model' : 'user'

        if (typeof msg.content === 'string') {
          return { role, parts: [{ text: msg.content }] }
        }

        const parts = (
          msg.content as Array<{
            type: string
            text?: string
            image_url?: { url: string }
          }>
        ).map((part) => {
          if (part.type === 'text') return { text: part.text ?? '' }
          const url = part.image_url?.url ?? ''
          if (url.startsWith('data:')) {
            const [meta, data] = url.split(',')
            const mimeType = meta.split(':')[1].split(';')[0]
            return { inlineData: { mimeType, data } }
          }
          return { text: `[Image: ${url}]` }
        }) as any[]

        return { role, parts }
      })
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const start = Date.now()
    const genModel = this.client.getGenerativeModel({
      model: options.model,
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: options.systemPrompt,
    })

    const history = this.buildGoogleMessages(options.messages.slice(0, -1))
    const lastMessage = options.messages[options.messages.length - 1]
    const chat = genModel.startChat({ history })

    let lastParts: any[]
    if (typeof lastMessage.content === 'string') {
      lastParts = [{ text: lastMessage.content }]
    } else {
      lastParts = (
        lastMessage.content as Array<{ type: string; text?: string; image_url?: { url: string } }>
      ).map((p) => {
        if (p.type === 'text') return { text: p.text ?? '' }
        const url = p.image_url?.url ?? ''
        if (url.startsWith('data:')) {
          const [meta, data] = url.split(',')
          return { inlineData: { mimeType: meta.split(':')[1].split(';')[0], data } }
        }
        return { text: `[Image: ${url}]` }
      }) as any[]
    }

    const result = await chat.sendMessage(lastParts)
    const response = result.response
    const latencyMs = Date.now() - start

    return {
      id: `google-${Date.now()}`,
      model: options.model,
      provider: 'google',
      content: response.text(),
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: 'stop',
      latencyMs,
    }
  }

  async *chatStream(options: AIRequestOptions): AsyncGenerator<AIStreamChunk, void, unknown> {
    const genModel = this.client.getGenerativeModel({
      model: options.model,
      safetySettings: SAFETY_SETTINGS,
      systemInstruction: options.systemPrompt,
    })

    const history = this.buildGoogleMessages(options.messages.slice(0, -1))
    const lastMessage = options.messages[options.messages.length - 1]
    const chat = genModel.startChat({ history })

    const lastParts: any[] =
      typeof lastMessage.content === 'string'
        ? [{ text: lastMessage.content }]
        : (
          lastMessage.content as Array<{ type: string; text?: string }>
        ).map((p) => ({ text: p.text ?? '' }))

    const result = await chat.sendMessageStream(lastParts)

    let totalInputTokens = 0
    let totalOutputTokens = 0

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) yield { type: 'delta', delta: text }

      if (chunk.usageMetadata) {
        totalInputTokens = chunk.usageMetadata.promptTokenCount ?? 0
        totalOutputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0
      }
    }

    yield {
      type: 'done',
      finishReason: 'stop',
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? 'text-embedding-004'
    const genModel = this.client.getGenerativeModel({ model })

    const texts = Array.isArray(request.text) ? request.text : [request.text]
    const embeddings: number[][] = []
    let totalTokens = 0

    for (const text of texts) {
      const result = await genModel.embedContent(text)
      embeddings.push(result.embedding.values)
    }

    return { embeddings, model, usage: { totalTokens } }
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash',
    ]
  }
}
