import { create } from 'zustand'
import type { Conversation, Message } from '@go-ai/shared'
import { streamChat, api, getApiError } from '@/lib/api'

export interface ConversationFolder {
  id: string
  userId: string
  name: string
  color?: string | null
  icon?: string | null
  order: number
  createdAt: string
  _count?: { conversations: number }
}

interface ChatState {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>
  isStreaming: boolean
  streamingMessageId: string | null
  streamingContent: string
  error: string | null
  selectedModel: string
  selectedProvider: string
  abortController: AbortController | null
  folders: ConversationFolder[]
  webSearch: boolean

  // Actions
  setActiveConversation: (id: string | null) => void
  setSelectedModel: (model: string, provider: string) => void
  loadConversations: () => Promise<void>
  loadMessages: (conversationId: string) => Promise<void>
  sendMessage: (content: string, attachmentIds?: string[]) => Promise<void>
  stopStreaming: () => void
  deleteConversation: (id: string) => Promise<void>
  updateConversation: (id: string, data: Partial<Conversation>) => Promise<void>
  clearError: () => void
  loadFolders: () => Promise<void>
  createFolder: (name: string, color?: string, icon?: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  setWebSearch: (enabled: boolean) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  isStreaming: false,
  streamingMessageId: null,
  streamingContent: '',
  error: null,
  selectedModel: 'llama-3.3-70b-versatile',
  // selectedModel: 'llama3.2:3b',
  selectedProvider: 'groq',
  abortController: null,
  folders: [],
  webSearch: false,

  setActiveConversation: (id) => {
    set({ activeConversationId: id })
    if (id && !get().messages[id]) {
      get().loadMessages(id)
    }
  },

  setSelectedModel: (model, provider) => {
    set({ selectedModel: model, selectedProvider: provider })
  },

  loadConversations: async () => {
    try {
      const { data } = await api.get('/conversations')
      set({ conversations: data.items ?? data.data ?? [] })
    } catch (err) {
      set({ error: getApiError(err) })
    }
  },

  loadMessages: async (conversationId) => {
    try {
      const { data } = await api.get(`/conversations/${conversationId}/messages`)
      set((state) => ({
        messages: { ...state.messages, [conversationId]: data.data ?? [] },
      }))
    } catch (err) {
      set({ error: getApiError(err) })
    }
  },

  sendMessage: async (content, attachmentIds = []) => {
    const { activeConversationId, selectedModel, selectedProvider, webSearch } = get()
    const controller = new AbortController()

    // ─── Image generation trigger ───────────────────────────────
    const imageMatch = content.match(/^rasim\s+chi(?:z)?\s+(.+)/i)
      ?? content.match(/^rasm\s+chi(?:z)?\s+(.+)/i)
      ?? content.match(/^draw\s+(.+)/i)
      ?? content.match(/^generate\s+image\s+(.+)/i)

    if (imageMatch) {
      const prompt = imageMatch[1].trim()
      const initConvKey2 = activeConversationId ?? 'new'

      const tempUserMsg2: Message = {
        id: `temp-user-${Date.now()}`,
        conversationId: activeConversationId ?? '',
        role: 'user', content, status: 'complete',
        attachments: [], createdAt: new Date(),
      }
      const tempImgMsg: Message = {
        id: `temp-img-${Date.now()}`,
        conversationId: activeConversationId ?? '',
        role: 'assistant', content: '🎨 Rasm yaratilmoqda...', status: 'streaming',
        createdAt: new Date(),
      }

      set((state) => ({
        isStreaming: true,
        streamingMessageId: tempImgMsg.id,
        messages: {
          ...state.messages,
          [initConvKey2]: [...(state.messages[initConvKey2] ?? []), tempUserMsg2, tempImgMsg],
        },
      }))

      try {
        const { data } = await api.post('/images/generate', { prompt })
        const imgUrl = data.data.url
        const imgContent = `![${prompt}](${imgUrl})\n\n*"${prompt}"*`

        set((state) => {
          const msgs = state.messages[initConvKey2] ?? []
          return {
            isStreaming: false,
            streamingMessageId: null,
            messages: {
              ...state.messages,
              [initConvKey2]: msgs.map((m) =>
                m.id === tempImgMsg.id
                  ? { ...m, content: imgContent, status: 'complete' as const }
                  : m
              ),
            },
          }
        })
      } catch (err) {
        const errMsg = getApiError(err)
        set((state) => {
          const msgs = state.messages[initConvKey2] ?? []
          return {
            isStreaming: false,
            streamingMessageId: null,
            messages: {
              ...state.messages,
              [initConvKey2]: msgs.map((m) =>
                m.id === tempImgMsg.id
                  ? { ...m, content: `❌ ${errMsg}`, status: 'error' as const }
                  : m
              ),
            },
          }
        })
      }
      return
    }

    const initConvKey = activeConversationId ?? 'new'

    // Optimistic messages
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      conversationId: activeConversationId ?? '',
      role: 'user',
      content,
      status: 'complete',
      attachments: [],
      createdAt: new Date(),
    }

    const tempAssistantMsg: Message = {
      id: `temp-assistant-${Date.now()}`,
      conversationId: activeConversationId ?? '',
      role: 'assistant',
      content: '',
      status: 'streaming',
      model: selectedModel,
      provider: selectedProvider,
      createdAt: new Date(),
    }

    set((state) => ({
      isStreaming: true,
      streamingContent: '',
      streamingMessageId: tempAssistantMsg.id,
      abortController: controller,
      error: null,
      messages: {
        ...state.messages,
        [initConvKey]: [...(state.messages[initConvKey] ?? []), tempUserMsg, tempAssistantMsg],
      },
    }))

    let fullContent = ''
    let currentConvKey = initConvKey
    // Throttle React updates: batch delta events with rAF to avoid UI freezing
    let pendingFlush: ReturnType<typeof setTimeout> | null = null
    const scheduleFlush = () => {
      if (pendingFlush) return
      pendingFlush = setTimeout(() => {
        pendingFlush = null
        const snapshot = fullContent
        set((state) => {
          const msgs = state.messages[currentConvKey] ?? []
          return {
            streamingContent: snapshot,
            messages: {
              ...state.messages,
              [currentConvKey]: msgs.map((m) =>
                m.id === tempAssistantMsg.id
                  ? { ...m, content: snapshot, status: 'streaming' as const }
                  : m
              ),
            },
          }
        })
      }, 32) // ~30fps — balans: silliq va performance
    }

    try {
      for await (const event of streamChat(
        {
          conversationId: activeConversationId ?? undefined,
          content,
          attachmentIds,
          model: selectedModel,
          provider: selectedProvider,
          webSearch, // pass web search option
        },
        controller.signal
      )) {

        if (event.type === 'conversation_created') {
          const newConvId = event.conversationId as string
          currentConvKey = newConvId
          set((state) => {
            const oldMsgs = state.messages['new'] ?? []
            return {
              activeConversationId: newConvId,
              messages: {
                ...state.messages,
                [newConvId]: oldMsgs.map((m) => ({ ...m, conversationId: newConvId })),
                new: [],
              },
            }
          })
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', `/chat/${newConvId}`)
          }
          continue
        }

        if (event.type === 'delta' && event.delta) {
          fullContent += event.delta
          // Throttle React state updates to avoid freezing on fast streams
          scheduleFlush()
        }

        if (event.type === 'done') {
          // Clear any pending throttled flush and do a final sync update
          if (pendingFlush) { clearTimeout(pendingFlush); pendingFlush = null }
          set((state) => {
            const msgs = state.messages[currentConvKey] ?? []
            return {
              isStreaming: false,
              streamingMessageId: null,
              streamingContent: '',
              messages: {
                ...state.messages,
                [currentConvKey]: msgs.map((m) =>
                  m.id === tempAssistantMsg.id
                    ? {
                        ...m,
                        id: (event.messageId as string) ?? m.id,
                        content: fullContent,
                        status: 'complete' as const,
                        finishReason: event.finishReason as string,
                      }
                    : m
                ),
              },
            }
          })
          setTimeout(() => {
            get().loadConversations()
            get().loadFolders()
          }, 1500)
          break
        }

        if (event.type === 'error') {
          throw new Error((event.error as string) || 'AI error occurred.')
        }
      }
    } catch (err) {
      // Clear any pending throttled flush
      if (pendingFlush) { clearTimeout(pendingFlush); pendingFlush = null }
      if ((err as Error).name === 'AbortError') {
        set((state) => {
          const msgs = state.messages[currentConvKey] ?? []
          return {
            isStreaming: false,
            streamingMessageId: null,
            messages: {
              ...state.messages,
              [currentConvKey]: msgs.map((m) =>
                m.id === tempAssistantMsg.id
                  ? { ...m, content: fullContent || '(stopped)', status: 'complete' as const }
                  : m
              ),
            },
          }
        })
      } else {
        const errMsg = getApiError(err)
        set((state) => {
          const msgs = state.messages[currentConvKey] ?? []
          return {
            isStreaming: false,
            streamingMessageId: null,
            error: errMsg,
            messages: {
              ...state.messages,
              [currentConvKey]: msgs.map((m) =>
                m.id === tempAssistantMsg.id
                  ? { ...m, content: `❌ ${errMsg}`, status: 'error' as const }
                  : m
              ),
            },
          }
        })
        throw err
      }
    }
  },

  stopStreaming: () => {
    get().abortController?.abort()
    set({ isStreaming: false, abortController: null })
  },

  deleteConversation: async (id) => {
    await api.delete(`/conversations/${id}`)
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
      activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
    }))
  },

  updateConversation: async (id, data) => {
    try {
      await api.patch(`/conversations/${id}`, data)
      set((state) => ({
        conversations: state.conversations.map((c) => (c.id === id ? { ...c, ...data } : c)),
      }))
    } catch (err) {
      set({ error: getApiError(err) })
    }
  },

  clearError: () => set({ error: null }),

  loadFolders: async () => {
    try {
      const { data } = await api.get('/conversations/folders/list')
      set({ folders: data.data ?? [] })
    } catch (err) {
      set({ error: getApiError(err) })
    }
  },

  createFolder: async (name, color, icon) => {
    try {
      const { data } = await api.post('/conversations/folders', { name, color, icon })
      set((state) => ({
        folders: [...state.folders, data.data],
      }))
    } catch (err) {
      set({ error: getApiError(err) })
      throw err
    }
  },

  deleteFolder: async (id) => {
    try {
      await api.delete(`/conversations/folders/${id}`)
      set((state) => ({
        folders: state.folders.filter((f) => f.id !== id),
        conversations: state.conversations.map((c) =>
          c.folderId === id ? { ...c, folderId: null } : c
        ),
      }))
    } catch (err) {
      set({ error: getApiError(err) })
    }
  },

  setWebSearch: (enabled) => {
    set({ webSearch: enabled })
  },
}))
