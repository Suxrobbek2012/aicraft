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

export class OpenAIProvider extends BaseAIProvider {
  readonly provider: AIProvider = 'openai'
  readonly name: string = 'OpenAI'

  private client: OpenAI

  constructor(apiKey: string, orgId?: string, baseUrl?: string) {
    super()
    this.client = new OpenAI({
      apiKey,
      organization: orgId,
      baseURL: baseUrl,
      maxRetries: 3,
      timeout: 120_000,
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
      if (msg.role === 'system') {
        return { role: 'system', content: msg.content as string }
      }

      if (msg.role === 'tool') {
        return {
          role: 'tool' as const,
          tool_call_id: msg.toolCallId ?? '',
          content: msg.content as string,
        }
      }

      if (msg.role === 'assistant') {
        const param: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: typeof msg.content === 'string' ? msg.content : null,
        }
        if (msg.toolCalls?.length) {
          param.tool_calls = msg.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }))
        }
        return param
      }

      // user message
      if (typeof msg.content === 'string') {
        return { role: 'user', content: msg.content }
      }

      // multipart user message
      const parts: OpenAI.ChatCompletionContentPart[] = (
        msg.content as Array<{ type: string; text?: string; image_url?: { url: string; detail?: 'auto' | 'low' | 'high' } }>
      ).map((part) => {
        if (part.type === 'text') {
          return { type: 'text', text: part.text ?? '' }
        }
        return {
          type: 'image_url',
          image_url: { url: part.image_url?.url ?? '', detail: part.image_url?.detail ?? 'auto' },
        }
      })

      return { role: 'user', content: parts }
    })
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const start = Date.now()

    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push(...this.buildMessages(options.messages))

    const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    }

    if (options.tools?.length) {
      params.tools = options.tools.map((t) => ({
        type: 'function' as const,
        function: t.function,
      }))
      if (options.toolChoice) {
        params.tool_choice = options.toolChoice as OpenAI.ChatCompletionToolChoiceOption
      }
    }

    const response = await this.client.chat.completions.create(params)
    const choice = response.choices[0]
    const latencyMs = Date.now() - start

    return {
      id: response.id,
      model: response.model,
      provider: 'openai',
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
      finishReason: (choice.finish_reason as AIResponse['finishReason']) ?? 'stop',
      latencyMs,
    }
  }

  async *chatStream(options: AIRequestOptions): AsyncGenerator<AIStreamChunk, void, unknown> {
    const messages: OpenAI.ChatCompletionMessageParam[] = []
    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push(...this.buildMessages(options.messages))

    const params: OpenAI.ChatCompletionCreateParamsStreaming = {
      model: options.model,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    }

    if (options.tools?.length) {
      params.tools = options.tools.map((t) => ({
        type: 'function' as const,
        function: t.function,
      }))
    }

    const stream = await this.client.chat.completions.create(params)

    const toolCallAccumulators: Record<number, {
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }> = {}

    for await (const chunk of stream) {
      const choice = chunk.choices[0]

      if (!choice) {
        if (chunk.usage) {
          yield {
            type: 'done',
            finishReason: 'stop',
            usage: {
              inputTokens: chunk.usage.prompt_tokens,
              outputTokens: chunk.usage.completion_tokens,
              totalTokens: chunk.usage.total_tokens,
            },
          }
        }
        continue
      }

      const delta = choice.delta

      if (delta.content) {
        yield { type: 'delta', delta: delta.content }
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index
          if (!toolCallAccumulators[idx]) {
            toolCallAccumulators[idx] = {
              id: tc.id ?? '',
              type: 'function',
              function: { name: tc.function?.name ?? '', arguments: '' },
            }
          }
          if (tc.function?.arguments) {
            toolCallAccumulators[idx].function.arguments += tc.function.arguments
          }
          yield {
            type: 'tool_call_delta',
            toolCallIndex: idx,
            toolCallDelta: {
              id: tc.id,
              type: 'function',
              function: {
                name: tc.function?.name,
                arguments: tc.function?.arguments,
              },
            },
          }
        }
      }

      if (choice.finish_reason) {
        yield {
          type: 'done',
          finishReason: choice.finish_reason,
          usage: chunk.usage
            ? {
                inputTokens: chunk.usage.prompt_tokens,
                outputTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              }
            : undefined,
        }
      }
    }
  }

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? 'text-embedding-3-small'
    const input = Array.isArray(request.text) ? request.text : [request.text]

    const response = await this.client.embeddings.create({ model, input })

    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      usage: { totalTokens: response.usage.total_tokens },
    }
  }

  async listModels(): Promise<string[]> {
    const models = await this.client.models.list()
    return models.data
      .filter((m) => m.id.startsWith('gpt') || m.id.startsWith('o1') || m.id.startsWith('o3'))
      .map((m) => m.id)
  }
}
