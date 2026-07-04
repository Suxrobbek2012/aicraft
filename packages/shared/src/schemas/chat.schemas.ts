import { z } from 'zod'

export const SendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  content: z.string().min(1, 'Message cannot be empty').max(100000, 'Message is too long'),
  attachmentIds: z.array(z.string().uuid()).optional().default([]),
  model: z.string().optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().max(100000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(200000).optional(),
  enabledTools: z.array(z.string()).optional().default([]),
  parentMessageId: z.string().uuid().optional(),
  webSearch: z.boolean().optional(),
})

export const CreateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  systemPrompt: z.string().max(100000).optional(),
  workspaceId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional().default([]),
})

export const UpdateConversationSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  systemPrompt: z.string().max(100000).optional().nullable(),
  folderId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isShared: z.boolean().optional(),
})

export const SearchConversationsSchema = z.object({
  q: z.string().min(1).max(500),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
})

export const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  icon: z.string().optional(),
})

export type SendMessageInput = z.infer<typeof SendMessageSchema>
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>
export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>
export type SearchConversationsInput = z.infer<typeof SearchConversationsSchema>
export type CreateFolderInput = z.infer<typeof CreateFolderSchema>
