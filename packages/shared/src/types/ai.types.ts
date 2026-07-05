export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'xai'
  | 'perplexity'
  | 'ollama'
  | 'groq'
  | 'custom'

export interface AIModel {
  id: string
  name: string
  provider: AIProvider
  contextWindow: number
  maxOutputTokens: number
  supportsVision: boolean
  supportsTools: boolean
  supportsStreaming: boolean
  inputPricePerMillion: number
  outputPricePerMillion: number
  isEnabled: boolean
  isDefault: boolean
  description?: string
  capabilities: ModelCapability[]
}

export type ModelCapability =
  | 'chat'
  | 'vision'
  | 'tools'
  | 'code'
  | 'reasoning'
  | 'search'
  | 'image_generation'
  | 'embedding'

export interface AIProviderConfig {
  provider: AIProvider
  apiKey?: string
  baseUrl?: string
  orgId?: string
  defaultModel: string
  isEnabled: boolean
  timeout: number
  maxRetries: number
  models: AIModel[]
}

export interface AIRequestOptions {
  model: string
  provider: AIProvider
  messages: AIMessage[]
  systemPrompt?: string
  temperature?: number
  topP?: number
  repeatPenalty?: number
  maxTokens?: number
  contextLength?: number
  stop?: string[]
  tools?: AITool[]
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'function'; function: { name: string } }
  stream?: boolean
  userId?: string
  conversationId?: string
  metadata?: Record<string, unknown>
}

export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string | AIMessagePart[]
  toolCallId?: string
  toolCalls?: import('./chat.types').ToolCall[]
  name?: string
}

export type AIMessagePart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } }

export interface AITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AIResponse {
  id: string
  model: string
  provider: AIProvider
  content: string
  toolCalls?: import('./chat.types').ToolCall[]
  usage: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error'
  latencyMs: number
}

export interface AIStreamChunk {
  type: 'delta' | 'tool_call_delta' | 'done'
  delta?: string
  toolCallIndex?: number
  toolCallDelta?: {
    id?: string
    type?: 'function'
    function?: {
      name?: string
      arguments?: string
    }
  }
  finishReason?: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
}

export interface EmbeddingRequest {
  text: string | string[]
  model?: string
  provider?: AIProvider
}

export interface EmbeddingResponse {
  embeddings: number[][]
  model: string
  usage: { totalTokens: number }
}
