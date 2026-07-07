'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageBubble } from '@/components/chat/message-bubble'
import type { Message } from '@go-ai/shared'

interface VirtualMessageListProps {
  messages: Message[]
  isStreaming: boolean
  streamingMessageId: string | null
  onRegenerate?: (messageId: string) => void
}

/**
 * Virtual scrolling message list — faqat ko'rinadigan xabarlarni render qiladi.
 * 50+ xabar bo'lganda telefonda qotib qolishni oldini oladi.
 */
export function VirtualMessageList({
  messages,
  isStreaming,
  streamingMessageId,
  onRegenerate,
}: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // taxminiy xabar balandligi
    overscan: 10, // ekrandan tashqari 10 ta xabar
  })

  const items = virtualizer.getVirtualItems()

  // Auto scroll to bottom on new messages
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevLength = useRef(messages.length)

  useEffect(() => {
    if (messages.length > prevLength.current) {
      // Scroll to bottom when new message arrives
      const lastIndex = virtualizer.getVirtualItems().length - 1
      if (lastIndex >= 0) {
        virtualizer.scrollToIndex(messages.length - 1, { align: 'end' })
      }
    }
    prevLength.current = messages.length
  }, [messages.length])

  return (
    <div
      ref={parentRef}
      className="flex-1 overflow-y-auto overscroll-contain will-change-transform"
      style={{
        contain: 'strict',
        height: '100%',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            transform: `translateY(${items[0]?.start ?? 0}px)`,
          }}
        >
          <div className="max-w-3xl mx-auto px-4">
            {items.map((virtualRow) => {
              const message = messages[virtualRow.index]
              const showAvatar =
                virtualRow.index === 0 ||
                messages[virtualRow.index - 1]?.role !== message.role

              return (
                <div
                  key={message.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="py-0.5"
                >
                  <MessageBubble
                    message={message}
                    isStreaming={isStreaming && message.id === streamingMessageId}
                    showAvatar={showAvatar}
                    onRegenerate={onRegenerate ? () => onRegenerate(message.id) : undefined}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div ref={bottomRef} className="h-4" />
    </div>
  )
}
