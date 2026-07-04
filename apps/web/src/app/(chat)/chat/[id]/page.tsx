'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ChatWindow } from '@/components/chat/chat-window'
import { ChatHeader } from '@/components/chat/chat-header'
import { useChatStore } from '@/store/chat.store'

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const { setActiveConversation } = useChatStore()

  useEffect(() => {
    if (id) setActiveConversation(id)
  }, [id])

  return (
    <div className="flex flex-col h-full">
      <ChatHeader />
      <div className="flex-1 overflow-hidden">
        <ChatWindow conversationId={id} />
      </div>
    </div>
  )
}
