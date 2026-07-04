import { ChatWindow } from '@/components/chat/chat-window'
import { ChatHeader } from '@/components/chat/chat-header'

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <ChatHeader />
      <div className="flex-1 overflow-hidden">
        <ChatWindow />
      </div>
    </div>
  )
}
