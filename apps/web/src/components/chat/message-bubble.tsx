'use client'

import React, { useState, memo } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  Copy, Check, RefreshCw, ThumbsUp, ThumbsDown,
  User, Bot, ChevronDown, ChevronUp, Volume2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn, getModelIcon, getModelDisplayName, formatDate } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import copy from 'copy-to-clipboard'
import toast from 'react-hot-toast'
import type { Message } from '@go-ai/shared'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  onRegenerate?: () => void
  showAvatar?: boolean
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isStreaming,
  onRegenerate,
  showAvatar = true,
}: MessageBubbleProps) {
  const { user } = useAuthStore()
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const handleCopy = () => {
    copy(message.content)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  if (message.role === 'system') return null

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'chat-message-shell',
          isUser ? 'flex-row-reverse' : 'flex-row'
        )}
      >
        {/* Avatar */}
        {showAvatar && (
          <div className="shrink-0 mt-0.5">
            {isUser ? (
              <Avatar className="h-7 w-7">
                <AvatarImage src={user?.avatarUrl ?? undefined} />
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {user?.displayName?.[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className={cn('flex-1 min-w-0 space-y-1', isUser && 'items-end flex flex-col')}>
          {/* Model badge for assistant */}
          {!isUser && message.model && (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {getModelIcon(message.provider ?? 'groq')}
                {getModelDisplayName(message.model)}
              </span>
              {isStreaming && (
                <Badge variant="green" className="text-xs py-0 px-1.5 animate-pulse">
                  Streaming
                </Badge>
              )}
            </div>
          )}

          {/* Message content */}
          <div
            className={cn(
              'message-bubble-content',
              isUser
                ? 'message-bubble-user'
                : 'message-bubble-assistant'
            )}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
            ) : (
              <div className={cn('prose-chat text-sm', collapsed && 'max-h-48 overflow-hidden')}>
                {/* Streaming paytida plain text — ReactMarkdown ni skip qilib freeze oldini olamiz */}
                {isStreaming
                  ? <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                  : <MarkdownContent content={message.content} />
                }
              </div>
            )}

            {/* Streaming cursor */}
            {isStreaming && !isUser && (
              <span className="inline-block w-0.5 h-4 bg-primary animate-blink ml-0.5 align-middle" />
            )}

            {/* Long message collapse */}
            {!isUser && !isStreaming && message.content.length > 2000 && (
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
              >
                {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                {collapsed ? 'Show more' : 'Show less'}
              </button>
            )}
          </div>

          {/* File attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className={cn('flex flex-wrap gap-2', isUser && 'justify-end')}>
              {message.attachments.map((att) => (
                <AttachmentPreview key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Actions (visible on hover) */}
          {!isStreaming && (
            <div
              className={cn(
                'message-bubble-actions',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={handleCopy} className="h-6 w-6 text-muted-foreground">
                    {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>

              {!isUser && onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" onClick={onRegenerate} className="h-6 w-6 text-muted-foreground">
                      <RefreshCw className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerate</TooltipContent>
                </Tooltip>
              )}

              {!isUser && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground">
                        <ThumbsUp className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Good response</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground">
                        <ThumbsDown className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Bad response</TooltipContent>
                  </Tooltip>
                </>
              )}

              {/* Token count */}
              {!isUser && message.totalTokens && (
                <span className="text-xs text-muted-foreground/40 ml-1">
                  {message.totalTokens.toLocaleString()} tokens
                </span>
              )}

              {/* Timestamp */}
              <span className="text-xs text-muted-foreground/40 ml-1">
                {formatDate(message.createdAt, 'relative')}
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </TooltipProvider>
  )
})

function AttachmentPreview({ attachment }: { attachment: { id: string; name: string; mimeType: string; url?: string } }) {
  const isImage = attachment.mimeType.startsWith('image/')
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
      <span>{isImage ? '🖼️' : '📄'}</span>
      <span className="max-w-[120px] truncate">{attachment.name}</span>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        code({ node, className, children, ...props }) {
          const inline = !className
          const match = /language-(\w+)/.exec(className ?? '')
          const lang = match?.[1] ?? ''

          if (!inline && lang) {
            return <CodeBlock language={lang} code={String(children).replace(/\n$/, '')} />
          }

          return (
            <code className={cn('bg-secondary text-go-green-400 rounded px-1.5 py-0.5 text-sm font-mono', className)} {...props}>
              {children}
            </code>
          )
        },
        pre({ children }) {
          return <>{children}</>
        },
        a({ href, children }) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {children}
            </a>
          )
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          )
        },
        th({ children }) {
          return <th className="border border-border bg-secondary px-3 py-2 text-left font-semibold text-xs">{children}</th>
        },
        td({ children }) {
          return <td className="border border-border px-3 py-2 text-xs">{children}</td>
        },
        img({ src, alt }) {
          if (!src) return null
          // Handle both external URLs and data URLs
          const isData = src.startsWith('data:')
          const isExternal = src.startsWith('http')
          if (!isData && !isExternal) return null
          return (
            <span className="block my-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt ?? 'Generated image'}
                className="rounded-xl max-w-full max-h-[600px] object-contain border border-border shadow-lg"
                loading="lazy"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
              {alt && <span className="block text-xs text-muted-foreground mt-1 italic">{alt}</span>}
            </span>
          )
        },
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    copy(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="code-block-wrapper my-3 rounded-xl overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-secondary/80 px-4 py-2">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCopy}
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus as any}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: '#1e1e1e',
          fontSize: '13px',
          lineHeight: '1.6',
        }}
        showLineNumbers={code.split('\n').length > 5}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
