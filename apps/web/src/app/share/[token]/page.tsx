'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { Bot, Lock, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface SharedConversation {
  id: string
  title: string
  model: string
  createdAt: string
  messages: Array<{
    role: string
    content: string
    model?: string
    createdAt: string
  }>
}

export default function SharedConversationPage() {
  const { token } = useParams<{ token: string }>()
  const [conv, setConv] = useState<SharedConversation | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/conversations/shared/${token}`)
      .then(({ data }) => setConv(data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !conv) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <Lock className="h-12 w-12 text-muted-foreground/30" />
        <h1 className="text-xl font-semibold">Conversation not found</h1>
        <p className="text-muted-foreground text-sm">This link may be invalid or expired.</p>
        <Link href="/chat"><Button>Open aicraft</Button></Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">aicraft</span>
          </div>
          <Link href="/chat">
            <Button size="sm" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Try aicraft
            </Button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold mb-2">{conv.title}</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Shared conversation · {formatDate(conv.createdAt)} · {conv.messages.length} messages
          </p>

          <div className="space-y-4">
            {conv.messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center mt-1 ${
                  msg.role === 'user' ? 'bg-primary/20' : 'bg-secondary'
                }`}>
                  {msg.role === 'user' ? (
                    <span className="text-xs font-medium text-primary">U</span>
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className={`rounded-2xl px-4 py-3 max-w-2xl ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-card border border-border rounded-tl-sm'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
