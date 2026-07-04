export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled'
export type ConversationStatus = 'active' | 'archived' | 'deleted'

export interface Conversation {
  id: string
  userId: string
  workspaceId?: string | null
  title: string
  summary?: string | null
  model: string
  provider: string
  systemPrompt?: string | null
  status: ConversationStatus
  isPinned: boolean
  isShared: boolean
  shareToken?: string | null
  folderId?: string | null
  tags: string[]
  messageCount: number
  tokenCount: number
  createdAt: Date
  updatedAt: Date
  lastMessageAt?: Date | null
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  contentParts?: ContentPart[]
  status: MessageStatus
  model?: string | null
  provider?: string | null
  inputTokens?: number | null
  outputTokens?: number | null
  totalTokens?: number | null
  latencyMs?: number | null
  finishReason?: string | null
  toolCalls?: ToolCall[] | null
  toolResults?: ToolResult[] | null
  attachments?: MessageAttachment[]
  metadata?: Record<string, unknown>
  parentId?: string | null
  editedAt?: Date | null
  createdAt: Date
}

export interface ContentPart {
  type: 'text' | 'image_url' | 'tool_use' | 'tool_result'
  text?: string
  imageUrl?: { url: string; detail?: 'auto' | 'low' | 'high' }
  toolUse?: { id: string; name: string; input: unknown }
  toolResult?: { toolUseId: string; content: string }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ToolResult {
  toolCallId: string
  result: unknown
  error?: string
}

export interface MessageAttachment {
  id: string
  name: string
  type: string
  size: number
  url: string
  mimeType: string
  processingStatus: 'pending' | 'processing' | 'complete' | 'error'
  extractedText?: string | null
  metadata?: Record<string, unknown>
}

export interface ConversationFolder {
  id: string
  userId: string
  name: string
  color?: string | null
  icon?: string | null
  order: number
  createdAt: Date
}

export interface ChatStreamEvent {
  type:
    | 'start'
    | 'delta'
    | 'tool_call'
    | 'tool_result'
    | 'usage'
    | 'done'
    | 'error'
    | 'conversation_created'
  messageId?: string
  conversationId?: string
  delta?: string
  toolCall?: ToolCall
  toolResult?: ToolResult
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  error?: string
  finishReason?: string
}

export interface SendMessageRequest {
  conversationId?: string
  content: string
  attachments?: string[]
  model?: string
  provider?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  tools?: string[]
  webSearch?: boolean
}
