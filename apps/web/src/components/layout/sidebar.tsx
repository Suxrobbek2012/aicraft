'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquarePlus, Search, Settings, LogOut, ChevronDown,
  Pin, Trash2, Archive, Edit2, MoreHorizontal, Folder, FolderPlus,
  Sparkles, Crown, Zap, Menu, X, Bot, Download, Check, ChevronRight,
  Sun, Moon,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { useChatStore, type ConversationFolder } from '@/store/chat.store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuPortal,
} from '@/components/ui/dropdown-menu'
import { cn, formatDate, truncateText } from '@/lib/utils'
import { ConversationSearch } from '@/components/chat/conversation-search'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'
import type { Conversation } from '@go-ai/shared'
import { AicraftLogo } from '@/components/ui/aicraft-logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
}

const PLAN_ICONS = {
  FREE: null,
  PRO: <Zap className="h-3 w-3 text-yellow-400" />,
  ULTRA: <Crown className="h-3 w-3 text-purple-400" />,
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const {
    conversations,
    activeConversationId,
    setActiveConversation,
    loadConversations,
    deleteConversation,
    folders,
    loadFolders,
    createFolder,
    deleteFolder,
    updateConversation,
    messages,
  } = useChatStore()

  const [searchOpen, setSearchOpen] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [filterQuery, setFilterQuery] = useState('')
  // Rename states
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  useEffect(() => {
    loadConversations()
    loadFolders()
  }, [])

  // Listen for global search shortcut (Ctrl+K / Cmd+K from chat input)
  useEffect(() => {
    const handler = () => setSearchOpen(true)
    window.addEventListener('open-search', handler)
    return () => window.removeEventListener('open-search', handler)
  }, [])

  const handleNewChat = () => {
    setActiveConversation(null)
    router.push('/chat')
    window.dispatchEvent(new CustomEvent('sidebar-close'))
  }

  const handleSelectConversation = (id: string) => {
    setActiveConversation(id)
    router.push(`/chat/${id}`)
    // Mobileda sidebar yopilsin
    window.dispatchEvent(new CustomEvent('sidebar-close'))
  }

  const handleLogout = async () => {
    await logout()
    router.push('/login')
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    try {
      await createFolder(newFolderName.trim())
      setNewFolderName('')
      setShowNewFolderInput(false)
      toast.success('Folder created')
    } catch {
      toast.error('Failed to create folder')
    }
  }

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }))
  }

  const handleArchiveConversation = async (id: string) => {
    try {
      await api.post(`/conversations/${id}/archive`)
      toast.success('Conversation archived')
      loadConversations()
    } catch {
      toast.error('Failed to archive conversation')
    }
  }

  const handleExportChat = async (conversation: Conversation) => {
    let chatMessages = messages[conversation.id]
    if (!chatMessages) {
      try {
        const { data } = await api.get(`/conversations/${conversation.id}/messages`)
        chatMessages = data.data
      } catch {
        toast.error('Failed to load chat messages for export')
        return
      }
    }

    if (!chatMessages || chatMessages.length === 0) {
      toast.error('No messages to export')
      return
    }

    let mdContent = `# ${conversation.title}\n\n`
    mdContent += `*Created: ${new Date(conversation.createdAt).toLocaleString()}*\n`
    mdContent += `*Model: ${conversation.model} (${conversation.provider})*\n\n`
    mdContent += `---\n\n`

    for (const msg of chatMessages) {
      const roleName = msg.role === 'user' ? 'User' : 'Assistant'
      mdContent += `### **${roleName}** (${new Date(msg.createdAt).toLocaleTimeString()})\n\n`
      mdContent += `${msg.content}\n\n`
      mdContent += `---\n\n`
    }

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `${conversation.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_chat.md`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Chat exported')
  }

  const handleStartRename = (conversation: Conversation) => {
    setRenamingId(conversation.id)
    setRenameTitle(conversation.title)
  }

  const handleSaveRename = async (id: string) => {
    if (!renameTitle.trim()) return
    await updateConversation(id, { title: renameTitle.trim() })
    setRenamingId(null)
    toast.success('Renamed conversation')
  }

  // Pinned chats
  const pinnedConversations = conversations.filter((c) => c.isPinned)

  // Non-pinned chats outside folders
  const rootConversations = conversations.filter((c) => !c.isPinned && !c.folderId)

  // Filter by query
  const filteredPinned = pinnedConversations.filter((c) =>
    !filterQuery || c.title.toLowerCase().includes(filterQuery.toLowerCase())
  )
  const filteredRoot = rootConversations.filter((c) =>
    !filterQuery || c.title.toLowerCase().includes(filterQuery.toLowerCase())
  )

  // Group root conversations by date
  const groupedRootConversations = groupConversationsByDate(filteredRoot)

  if (collapsed) {
    return (
      <div className="flex h-full w-14 flex-col items-center border-r border-border bg-card py-3 gap-2">
        <Button variant="ghost" size="icon" onClick={onToggle} className="text-muted-foreground">
          <Menu className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNewChat} className="text-primary">
          <MessageSquarePlus className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="text-muted-foreground">
          <Search className="h-5 w-5" />
        </Button>
        <div className="flex-1" />
        <Avatar className="h-8 w-8 cursor-pointer" onClick={() => router.push('/settings')}>
          <AvatarImage src={user?.avatarUrl ?? undefined} />
          <AvatarFallback>{user?.displayName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
        </Avatar>
      </div>
    )
  }

  return (
    <>
      <ConversationSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      <div className="flex h-full w-64 flex-col border-r border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-2">
          <AicraftLogo size={28} />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon-sm" onClick={onToggle} className="text-muted-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Action Panel */}
        <div className="px-2 pb-2 flex flex-col gap-1">
          <Button
            onClick={handleNewChat}
            variant="ghost"
            className="w-full justify-start gap-2 text-sm h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            New conversation
          </Button>
          <Button
            onClick={() => setSearchOpen(true)}
            variant="ghost"
            className="w-full justify-start gap-2 text-sm h-9 px-2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
            Search conversations
            <kbd className="ml-auto text-xs text-muted-foreground/60 border border-border rounded px-1">⌘K</kbd>
          </Button>
        </div>

        <div className="h-px bg-border mx-3 mb-2" />

        {/* Filter input */}
        <div className="px-2 pb-2">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-1.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter chats..."
              className="flex-1 bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground/60"
            />
            {filterQuery && (
              <button onClick={() => setFilterQuery('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Scrollable list */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-4 pb-4">
            {/* Pinned Chats */}
            {filteredPinned.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                  <Pin className="h-3 w-3 text-primary" /> Pinned
                </p>
                <div className="space-y-0.5">
                  {filteredPinned.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      folders={folders}
                      isActive={conv.id === activeConversationId}
                      isHovered={hoveredId === conv.id}
                      renamingId={renamingId}
                      renameTitle={renameTitle}
                      setRenameTitle={setRenameTitle}
                      onHover={setHoveredId}
                      onSelect={handleSelectConversation}
                      onDelete={deleteConversation}
                      onPin={(c) => updateConversation(c.id, { isPinned: !c.isPinned })}
                      onArchive={handleArchiveConversation}
                      onExport={handleExportChat}
                      onStartRename={handleStartRename}
                      onSaveRename={handleSaveRename}
                      onCancelRename={() => setRenamingId(null)}
                      onMoveToFolder={(cid, fid) => updateConversation(cid, { folderId: fid })}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Folders List */}
            <div>
              <div className="px-2 py-1 flex items-center justify-between text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                <span>Folders</span>
                <button
                  onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                  className="hover:text-primary transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Inline Folder Creation */}
              <AnimatePresence>
                {showNewFolderInput && (
                  <motion.form
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    onSubmit={handleCreateFolder}
                    className="px-2 py-1.5 flex gap-1 items-center"
                  >
                    <input
                      autoFocus
                      type="text"
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="flex-1 bg-secondary text-xs rounded-lg px-2.5 py-1 border border-border outline-none text-foreground"
                    />
                    <Button type="submit" size="icon-sm" className="h-7 w-7 rounded-lg">
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setShowNewFolderInput(false)}
                      className="h-7 w-7 rounded-lg"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Folder Accordion List */}
              <div className="space-y-1 mt-1">
                {folders.map((folder) => {
                  const isExpanded = !!expandedFolders[folder.id]
                  const folderConvs = conversations.filter((c) => c.folderId === folder.id && !c.isPinned)

                  return (
                    <div key={folder.id} className="rounded-xl overflow-hidden bg-secondary/20 border border-transparent hover:border-border/40 transition-colors">
                      {/* Folder Header */}
                      <div className="group/folder flex items-center justify-between px-2 py-1.5 cursor-pointer select-none hover:bg-secondary/40">
                        <div
                          className="flex items-center gap-2 flex-1 min-w-0"
                          onClick={() => toggleFolder(folder.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate">
                            {folder.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">
                            ({folderConvs.length})
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            if (confirm(`Delete folder "${folder.name}"? Conversations will be moved to root.`)) {
                              deleteFolder(folder.id)
                            }
                          }}
                          className="opacity-0 group-hover/folder:opacity-100 p-1 hover:text-destructive text-muted-foreground transition-all duration-150"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Folder Conversations */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden border-t border-border/10 pl-2 bg-card/40"
                          >
                            {folderConvs.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground/50 py-2 px-3 italic">
                                Empty folder
                              </p>
                            ) : (
                              <div className="py-0.5 space-y-0.5">
                                {folderConvs.map((conv) => (
                                  <ConversationItem
                                    key={conv.id}
                                    conversation={conv}
                                    folders={folders}
                                    isActive={conv.id === activeConversationId}
                                    isHovered={hoveredId === conv.id}
                                    renamingId={renamingId}
                                    renameTitle={renameTitle}
                                    setRenameTitle={setRenameTitle}
                                    onHover={setHoveredId}
                                    onSelect={handleSelectConversation}
                                    onDelete={deleteConversation}
                                    onPin={(c) => updateConversation(c.id, { isPinned: !c.isPinned })}
                                    onArchive={handleArchiveConversation}
                                    onExport={handleExportChat}
                                    onStartRename={handleStartRename}
                                    onSaveRename={handleSaveRename}
                                    onCancelRename={() => setRenamingId(null)}
                                    onMoveToFolder={(cid, fid) => updateConversation(cid, { folderId: fid })}
                                  />
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Root Conversations */}
            {conversations.length > 0 && (
              <div>
                <p className="px-2 py-1 text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  Chats
                </p>
                <div className="space-y-4">
                  {Object.entries(groupedRootConversations).map(([label, convs]) => (
                    <div key={label} className="space-y-0.5">
                      <p className="px-2 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">
                        {label}
                      </p>
                      {convs.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          folders={folders}
                          isActive={conv.id === activeConversationId}
                          isHovered={hoveredId === conv.id}
                          renamingId={renamingId}
                          renameTitle={renameTitle}
                          setRenameTitle={setRenameTitle}
                          onHover={setHoveredId}
                          onSelect={handleSelectConversation}
                          onDelete={deleteConversation}
                          onPin={(c) => updateConversation(c.id, { isPinned: !c.isPinned })}
                          onArchive={handleArchiveConversation}
                          onExport={handleExportChat}
                          onStartRename={handleStartRename}
                          onSaveRename={handleSaveRename}
                          onCancelRename={() => setRenamingId(null)}
                          onMoveToFolder={(cid, fid) => updateConversation(cid, { folderId: fid })}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* User Footer Panel */}
        <div className="border-t border-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-secondary transition-colors">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={user?.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-xs">{user?.displayName?.[0]?.toUpperCase() ?? 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-medium truncate text-foreground">{user?.displayName}</p>
                  <div className="flex items-center gap-1">
                    {PLAN_ICONS[user?.plan as keyof typeof PLAN_ICONS]}
                    <p className="text-xs text-muted-foreground truncate">{user?.plan}</p>
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52" side="top">
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="h-4 w-4" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/settings/billing')}>
                <Crown className="h-4 w-4" /> Upgrade plan
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  folders: ConversationFolder[]
  isActive: boolean
  isHovered: boolean
  renamingId: string | null
  renameTitle: string
  setRenameTitle: (val: string) => void
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onPin: (conversation: Conversation) => void
  onArchive: (id: string) => void
  onExport: (conversation: Conversation) => void
  onStartRename: (conversation: Conversation) => void
  onSaveRename: (id: string) => void
  onCancelRename: () => void
  onMoveToFolder: (conversationId: string, folderId: string | null) => void
}

function ConversationItem({
  conversation,
  folders,
  isActive,
  isHovered,
  renamingId,
  renameTitle,
  setRenameTitle,
  onHover,
  onSelect,
  onDelete,
  onPin,
  onArchive,
  onExport,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onMoveToFolder,
}: ConversationItemProps) {
  const isRenaming = renamingId === conversation.id
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSaveRename(conversation.id)
    } else if (e.key === 'Escape') {
      onCancelRename()
    }
  }

  return (
    <motion.div
      layout
      onMouseEnter={() => onHover(conversation.id)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        'group relative flex items-center rounded-xl px-2 py-2 cursor-pointer transition-colors duration-150',
        isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
      )}
      onClick={() => {
        if (!isRenaming) onSelect(conversation.id)
      }}
    >
      {conversation.isPinned && (
        <Pin className="h-3.5 w-3.5 text-primary shrink-0 mr-1.5" />
      )}

      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={renameTitle}
          onChange={(e) => setRenameTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onSaveRename(conversation.id)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-background text-xs border border-primary/50 outline-none rounded px-1.5 py-0.5 text-foreground font-normal"
        />
      ) : (
        <span className="flex-1 truncate text-xs leading-tight">
          {truncateText(conversation.title, 32)}
        </span>
      )}

      {!isRenaming && (isActive || isHovered) ? (
        <div
          className="ml-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 opacity-70 hover:opacity-100">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => onStartRename(conversation)}>
                <Edit2 className="h-4 w-4 mr-2" /> Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPin(conversation)}>
                <Pin className="h-4 w-4 mr-2" /> {conversation.isPinned ? 'Unpin' : 'Pin'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onArchive(conversation.id)}>
                <Archive className="h-4 w-4 mr-2" /> Archive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport(conversation)}>
                <Download className="h-4 w-4 mr-2" /> Export (Markdown)
              </DropdownMenuItem>

              {/* Move to Folder Submenu */}
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Folder className="h-4 w-4 mr-2 text-primary" /> Move to Folder
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-48">
                    <DropdownMenuItem onClick={() => onMoveToFolder(conversation.id, null)}>
                      <span className="italic">None (Root)</span>
                    </DropdownMenuItem>
                    {folders.map((f) => (
                      <DropdownMenuItem key={f.id} onClick={() => onMoveToFolder(conversation.id, f.id)}>
                        <Folder className="h-3.5 w-3.5 mr-2 text-primary" />
                        {f.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => {
                  if (confirm(`Delete conversation "${conversation.title}"?`)) {
                    onDelete(conversation.id)
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        !isRenaming && (
          <span className="ml-1 shrink-0 text-[10px] text-muted-foreground/40 font-mono">
            {conversation.lastMessageAt ? formatDate(conversation.lastMessageAt) : ''}
          </span>
        )
      )}
    </motion.div>
  )
}

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const lastWeek = new Date(today.getTime() - 7 * 86400000)
  const lastMonth = new Date(today.getTime() - 30 * 86400000)

  const groups: Record<string, Conversation[]> = {}

  for (const conv of conversations) {
    const date = new Date(conv.lastMessageAt ?? conv.createdAt)
    let label: string

    if (date >= today) label = 'Today'
    else if (date >= yesterday) label = 'Yesterday'
    else if (date >= lastWeek) label = 'This Week'
    else if (date >= lastMonth) label = 'This Month'
    else label = 'Older'

    if (!groups[label]) groups[label] = []
    groups[label].push(conv)
  }

  return groups
}
