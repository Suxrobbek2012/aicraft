'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Code, Brain, Calculator, ImageIcon } from 'lucide-react'
import { ChatInput } from '@/components/chat/chat-input'
import { VirtualMessageList } from '@/components/chat/virtual-message-list'
import { Skeleton } from '@/components/ui/skeleton'
import { useChatStore } from '@/store/chat.store'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { AicraftLogo } from '@/components/ui/aicraft-logo'

const WELCOME_SUGGESTIONS = [
  { icon: <Code className="h-4 w-4" />, text: 'React component yozib ber login formasi' },
  { icon: <Brain className="h-4 w-4" />, text: 'Nima uchun osmon ko\'k rangda?' },
  { icon: <Calculator className="h-4 w-4" />, text: 'Hisobla: 245 * 378 + 15623 / 45' },
  { icon: <ImageIcon className="h-4 w-4" />, text: 'Rasm chiz: moviy okean va quyosh botishi' },
]

interface ChatWindowProps {
  conversationId?: string
}

export function ChatWindow({ conversationId }: ChatWindowProps) {
  const { user } = useAuthStore()
  const {
    messages,
    isStreaming,
    streamingMessageId,
    activeConversationId,
    loadMessages,
    sendMessage,
  } = useChatStore()

  const [messagesLoading, setMessagesLoading] = React.useState(false)

  const convId = conversationId ?? activeConversationId ?? 'new'
  const convMessages = messages[convId] ?? []

  // When a new conversation is created, update URL
  const prevActiveConvId = React.useRef<string | null>(null)
  useEffect(() => {
    if (
      !conversationId &&
      activeConversationId &&
      activeConversationId !== prevActiveConvId.current
    ) {
      prevActiveConvId.current = activeConversationId
      window.history.replaceState(null, '', `/chat/${activeConversationId}`)
    }
  }, [activeConversationId, conversationId])

  // Load messages when conversation changes
  useEffect(() => {
    if (convId && !messages[convId]) {
      setMessagesLoading(true)
      loadMessages(convId).finally(() => setMessagesLoading(false))
    }
  }, [convId])

  const handleSuggestionClick = (text: string) => {
    sendMessage(text)
  }

  // Empty state — welcome screen
  const showWelcome = convMessages.length === 0 && !isStreaming && !messagesLoading

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      {/* Messages area */}
      {messagesLoading ? (
        <div className="chat-window-messages-area flex-1 overflow-y-auto overscroll-contain px-4">
          <div className="max-w-3xl mx-auto">
            <MessagesSkeleton />
          </div>
        </div>
      ) : showWelcome ? (
        <div className="chat-window-messages-area flex-1 overflow-y-auto overscroll-contain px-4">
          <div className="max-w-3xl mx-auto">
            <WelcomeScreen
              userName={user?.displayName}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
        </div>
      ) : (
        <VirtualMessageList
          messages={convMessages}
          isStreaming={isStreaming}
          streamingMessageId={streamingMessageId}
        />
      )}

      {/* Input area */}
      <div className="chat-window-input-panel">
        <div className="max-w-3xl mx-auto px-2 md:px-4 py-2 md:py-4">
          <ChatInput />
        </div>
      </div>
    </div>
  )
}

function WelcomeScreen({
  userName,
  onSuggestionClick,
}: {
  userName?: string
  onSuggestionClick: (text: string) => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-160px)] py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center w-full max-w-lg"
      >
        <div className="flex items-center justify-center mb-4">
          <AicraftLogo size={40} showText={false} />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          {userName ? `Salom, ${userName.split(' ')[0]} 👋` : 'Aicraftga xush kelibsiz!'}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base mb-8">
          Sizga qanday yordam bera olaman?
        </p>

        {/* Suggestion chips */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WELCOME_SUGGESTIONS.map((suggestion, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              onClick={() => onSuggestionClick(suggestion.text)}
              className="flex items-center gap-2.5 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 px-4 py-3 text-sm text-left text-foreground/80 hover:text-foreground transition-all duration-200 group"
            >
              <span className="text-primary shrink-0">{suggestion.icon}</span>
              <span className="truncate">{suggestion.text}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

function MessagesSkeleton() {
  return (
    <div className="py-6 space-y-6">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={cn('flex gap-3 px-4', i % 2 !== 0 && 'flex-row-reverse')}>
          <Skeleton className="h-7 w-7 rounded-full shrink-0" />
          <div className="space-y-2 flex-1 max-w-lg">
            <Skeleton className="h-4 w-full rounded-xl" />
            <Skeleton className="h-4 w-4/5 rounded-xl" />
            {i % 2 === 0 && <Skeleton className="h-4 w-3/5 rounded-xl" />}
          </div>
        </div>
      ))}
    </div>
  )
}
