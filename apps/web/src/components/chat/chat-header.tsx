'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Menu, Share2, MoreHorizontal, Edit2, Archive,
  Trash2, Pin, Download, Bot, ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useChatStore } from '@/store/chat.store'
import { api, getApiError } from '@/lib/api'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { TokenStatus } from './token-status'

interface ChatHeaderProps {
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
}

export function ChatHeader({ onToggleSidebar, sidebarCollapsed }: ChatHeaderProps) {
  const router = useRouter()
  const { activeConversationId, conversations, updateConversation, deleteConversation } = useChatStore()
  const [renameOpen, setRenameOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [renaming, setRenaming] = useState(false)

  const activeConv = conversations.find((c) => c.id === activeConversationId)

  const handleRename = async () => {
    if (!activeConversationId || !newTitle.trim()) return
    setRenaming(true)
    try {
      await api.patch(`/conversations/${activeConversationId}`, { title: newTitle.trim() })
      updateConversation(activeConversationId, { title: newTitle.trim() })
      setRenameOpen(false)
      toast.success('Conversation renamed')
    } catch (err) {
      toast.error(getApiError(err))
    } finally {
      setRenaming(false)
    }
  }

  const handleShare = async () => {
    if (!activeConversationId) return
    try {
      const { data } = await api.patch(`/conversations/${activeConversationId}`, { isShared: true })
      const shareUrl = `${window.location.origin}/share/${data.data?.shareToken}`
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied to clipboard')
    } catch {
      toast.error('Failed to create share link')
    }
  }

  const handlePin = async () => {
    if (!activeConversationId || !activeConv) return
    try {
      await api.patch(`/conversations/${activeConversationId}`, { isPinned: !activeConv.isPinned })
      updateConversation(activeConversationId, { isPinned: !activeConv.isPinned })
      toast.success(activeConv.isPinned ? 'Unpinned' : 'Pinned')
    } catch {
      toast.error('Failed to update conversation')
    }
  }

  const handleDelete = async () => {
    if (!activeConversationId) return
    if (!confirm('Delete this conversation? This cannot be undone.')) return
    await deleteConversation(activeConversationId)
    router.push('/chat')
  }

  return (
    <>
      <TooltipProvider>
        <div className="flex h-14 items-center gap-2 border-b border-border px-4 shrink-0">
          {/* Sidebar toggle */}
          {sidebarCollapsed && (
            <Button variant="ghost" size="icon-sm" onClick={onToggleSidebar}>
              <Menu className="h-4 w-4" />
            </Button>
          )}

          {/* Conversation title */}
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            {activeConv ? (
              <button
                onClick={() => { setNewTitle(activeConv.title); setRenameOpen(true) }}
                className="truncate text-sm font-medium text-foreground hover:text-primary transition-colors max-w-xs"
              >
                {activeConv.title}
              </button>
            ) : (
              <span className="text-sm font-medium text-foreground">New Conversation</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <TokenStatus />

            {activeConversationId && (
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" onClick={handleShare} className="text-muted-foreground">
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Share conversation</TooltipContent>
                </Tooltip>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="text-muted-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => { setNewTitle(activeConv?.title ?? ''); setRenameOpen(true) }}>
                      <Edit2 className="h-4 w-4" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePin}>
                      <Pin className="h-4 w-4" />
                      {activeConv?.isPinned ? 'Unpin' : 'Pin'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleShare}>
                      <Share2 className="h-4 w-4" /> Share
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>
      </TooltipProvider>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Conversation</DialogTitle>
          </DialogHeader>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Conversation title"
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} loading={renaming} disabled={!newTitle.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
