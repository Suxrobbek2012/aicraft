'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Search, MessageSquare, Clock } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { useChatStore } from '@/store/chat.store'
import { cn, formatDate } from '@/lib/utils'

interface SearchResult {
  id: string
  title: string
  summary?: string
  lastMessageAt?: string
  messageCount: number
}

interface ConversationSearchProps {
  open: boolean
  onClose: () => void
}

export function ConversationSearch({ open, onClose }: ConversationSearchProps) {
  const router = useRouter()
  const { setActiveConversation } = useChatStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const { data } = await api.get('/conversations/search', { params: { q, pageSize: 10 } })
      setResults(data.data ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 300)
    return () => clearTimeout(timeout)
  }, [query, search])

  useEffect(() => {
    if (!open) { setQuery(''); setResults([]) }
  }, [open])

  const handleSelect = (id: string) => {
    setActiveConversation(id)
    router.push(`/chat/${id}`)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        <Command className="bg-transparent">
          <div className="flex items-center border-b border-border px-4 py-3 gap-3">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground text-foreground"
            />
            {loading && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent shrink-0" />
            )}
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            {results.length === 0 && query && !loading && (
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No conversations found for &ldquo;{query}&rdquo;
              </Command.Empty>
            )}

            {results.length === 0 && !query && (
              <div className="py-8 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Type to search your conversations</p>
              </div>
            )}

            {results.map((result) => (
              <Command.Item
                key={result.id}
                value={result.id}
                onSelect={() => handleSelect(result.id)}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 cursor-pointer hover:bg-secondary transition-colors aria-selected:bg-secondary"
              >
                <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-foreground">{result.title}</p>
                  {result.summary && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{result.summary}</p>
                  )}
                </div>
                {result.lastMessageAt && (
                  <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(result.lastMessageAt)}
                  </span>
                )}
              </Command.Item>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
