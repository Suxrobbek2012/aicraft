'use client'

import React, { useEffect, useState } from 'react'
import { Brain, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { api, getApiError } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Memory {
  id: string
  content: string
  importance: number
  accessCount: number
  createdAt: string
  lastAccessedAt?: string
}

export function MemorySettings() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMemories() }, [])

  const loadMemories = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/memories')
      setMemories(data.data ?? [])
    } catch { } finally { setLoading(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/memories/${id}`)
      setMemories((p) => p.filter((m) => m.id !== id))
    } catch (err) { toast.error(getApiError(err)) }
  }

  const handleClearAll = async () => {
    if (!confirm('Clear all memories? This cannot be undone.')) return
    try {
      await api.delete('/memories')
      setMemories([])
      toast.success('All memories cleared')
    } catch (err) { toast.error(getApiError(err)) }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold mb-1">Memory</h2>
          <p className="text-sm text-muted-foreground">aicraft remembers facts about you to personalize responses</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={loadMemories} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
          {memories.length > 0 && (
            <Button size="sm" variant="destructive" onClick={handleClearAll}>Clear All</Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />)}
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-border bg-secondary/20 py-16 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium">No memories yet</p>
          <p className="text-xs text-muted-foreground mt-1">Start chatting and aicraft will remember important facts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <div key={memory.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{memory.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Added {formatDate(memory.createdAt)} · Accessed {memory.accessCount} times
                </p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => handleDelete(memory.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
