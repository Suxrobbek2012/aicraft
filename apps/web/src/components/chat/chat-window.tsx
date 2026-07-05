'use client'

import React, { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, ArrowDown } from 'lucide-react'
import { MessageBubble } from '@/components/chat/message-bubble'
import { ChatInput } from '@/components/chat/chat-input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useChatStore } from '@/store/chat.store'
import { useAuthStore } from '@/store/auth.store'
import { cn } from '@/lib/utils'
import { AicraftLogo } from '@/components/ui/aicraft-logo'

const WELCOME_SUGGESTIONS: never[] = []

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

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = React.useState(false)
  const [messagesLoading, setMessagesLoading] = React.useState(false)
  const prevActiveConvId = useRef<string | null>(null)

  const convId = conversationId ?? activeConversationId ?? 'new'
  const convMessages = messages[convId] ?? []

  // When a new conversation is created (activeConversationId changes),
  // update URL without remounting the page using history API
  useEffect(() => {
    if (
      !conversationId &&
      activeConversationId &&
      activeConversationId !== prevActiveConvId.current
    ) {
      prevActiveConvId.current = activeConversationId
      // Use history.replaceState to avoid page remount
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isStreaming || convMessages.length > 0) {
      scrollToBottom()
    }
  }, [convMessages.length, isStreaming])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollButton(distanceFromBottom > 200)
  }, [])

  const handleSuggestionClick = (text: string) => {
    sendMessage(text)
  }

  // Empty state — welcome screen
  const showWelcome = convMessages.length === 0 && !isStreaming && !messagesLoading

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div
        className="chat-window-messages-area"
        onScroll={handleScroll}
        ref={scrollRef}
      >
        <div className="max-w-3xl mx-auto px-4">
          {messagesLoading ? (
            <MessagesSkeleton />
          ) : showWelcome ? (
            <WelcomeScreen
              userName={user?.displayName}
              onSuggestionClick={handleSuggestionClick}
            />
          ) : (
            <div className="py-4 space-y-1">
              <AnimatePresence initial={false}>
                {convMessages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isStreaming={isStreaming && message.id === streamingMessageId}
                    showAvatar={
                      index === 0 ||
                      convMessages[index - 1]?.role !== message.role
                    }
                  />
                ))}
              </AnimatePresence>
              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="chat-window-scroll-button"
            >
              <Button
                size="sm"
                variant="secondary"
                onClick={scrollToBottom}
                className="rounded-full shadow-lg gap-1.5 border border-border"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                Scroll to bottom
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input area */}
      <div className="chat-window-input-panel">
        <div className="max-w-3xl mx-auto px-4 py-4">
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
    <div className="flex flex-col items-center justify-center min-h-[calc(100svh-180px)] py-8 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="text-center"
      >
        <div className="flex items-center justify-center mb-4">
          <AicraftLogo size={40} showText={false} />
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-2">
          {userName ? `Hello, ${userName.split(' ')[0]} 👋` : 'Welcome to aicraft'}
        </h1>
        <p className="text-muted-foreground text-sm md:text-base">
          How can I help you today?
        </p>
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
