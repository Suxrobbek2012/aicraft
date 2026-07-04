import Anthropic from '@anthropic-ai/sdk'
import { BaseAIProvider } from './base.provider'
import type {
  AIRequestOptions,
  AIResponse,
  AIStreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  AIMessage,
} from '@go-ai/shared'

export class AnthropicProvider extends BaseAIProvider {
  readonly provider = 'anthropic' as const
  readonly name = 'Anthropic'

  private client: Anthropic

  constructor(apiKey: string) {
    super()
    this.client = new Anthropic({
      apiKey,
      maxRetries: 3,
      timeout: 120_000,
    })
  }

  async isAvailable(): Promise<boolean> {
    return !!this.client.apiKey
  }

  private buildMessages(messages: AIMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = []

    for (const msg of messages) {
      if (msg.role === 'system') continue // system is handled separately

      if (msg.role === 'tool') {
        result.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: msg.toolCallId ?? '',
              content: msg.content as string,
            },
          ],
        })
        continue
      }

      if (msg.role === 'assistant') {
        const content: Anthropic.ContentBlock[] = []
        if (msg.content) {
          content.push({ type: 'text', text: msg.content as string })
        }
        if (msg.toolCalls?.length) {
          for (const tc of msg.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
            })
          }
        }
        result.push({ role: 'assistant', content })
        continue
      }

      // user
      if (typeof msg.content === 'string') {
        result.push({ role: 'user', content: msg.content })
      } else {
        const parts = (
          msg.content as Array<{
            type: string
            text?: string
            image_url?: { url: string }
          }>
        ).map((part) => {
          if (part.type === 'text') {
            return { type: 'text' as const, text: part.text ?? '' }
          }
          // image
          const url = part.image_url?.url ?? ''
          if (url.startsWith('data:')) {
            const [meta, data] = url.split(',')
            const mediaType = meta.split(':')[1].split(';')[0] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
            return {
              type: 'image' as const,
              source: { type: 'base64' as const, media_type: mediaType, data },
            }
          }
          return {
            type: 'image' as const,
            source: { type: 'url' as const, url },
          }
        })
        result.push({ role: 'user', content: parts as Anthropic.MessageParam['content'] })
      }
    }

    return result
  }

  async chat(options: AIRequestOptions): Promise<AIResponse> {
    const start = Date.now()

    const systemPrompt =
      options.systemPrompt ??
      options.messages.find((m) => m.role === 'system')?.content as string | undefined

    const messages = this.buildMessages(options.messages.filter((m) => m.role !== 'system'))

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 8192,
      temperature: options.temperature,
      stream: false,
    }

    if (systemPrompt) params.system = systemPrompt

    if (options.tools?.length) {
      params.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
      }))
    }

    const response = await this.client.messages.create(params)
    const latencyMs = Date.now() - start

    let content = ''
    const toolCalls: AIResponse['toolCalls'] = []

    for (const block of response.content) {
      if (block.type === 'text') content += block.text
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        })
      }
    }

    const finishMap: Record<string, AIResponse['finishReason']> = {
      end_turn: 'stop',
      max_tokens: 'length',
      tool_use: 'tool_calls',
      stop_sequence: 'stop',
    }

    return {
      id: response.id,
      model: response.model,
      provider: 'anthropic',
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason: finishMap[response.stop_reason ?? 'end_turn'] ?? 'stop',
      latencyMs,
    }
  }

  async *chatStream(options: AIRequestOptions): AsyncGenerator<AIStreamChunk, void, unknown> {
    const systemPrompt =
      options.systemPrompt ??
      options.messages.find((m) => m.role === 'system')?.content as string | undefined

    const messages = this.buildMessages(options.messages.filter((m) => m.role !== 'system'))

    const params: Anthropic.MessageStreamParams = {
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 8192,
      temperature: options.temperature,
    }

    if (systemPrompt) params.system = systemPrompt

    if (options.tools?.length) {
      params.tools = options.tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
      }))
    }

    const stream = this.client.messages.stream(params)

    let inputTokens = 0
    let outputTokens = 0

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'delta', delta: event.delta.text }
        } else if (event.delta.type === 'input_json_delta') {
          yield {
            type: 'tool_call_delta',
            toolCallIndex: event.index,
            toolCallDelta: {
              function: { arguments: event.delta.partial_json },
            },
          }
        }
      }

      if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens
      }

      if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens
      }

      if (event.type === 'message_stop') {
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
    }
  }

  async embed(_request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Anthropic does not offer a public embedding API; throw a clear error
    throw this.buildError('Anthropic does not support embeddings via API', 'UNSUPPORTED_OPERATION')
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229'
    ]
  }
}
