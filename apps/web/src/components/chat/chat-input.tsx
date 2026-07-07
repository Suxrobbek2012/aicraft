'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TextareaAutosize from 'react-textarea-autosize'
import {
  Send, Square, Paperclip, Mic, MicOff, X,
  Image as ImageIcon, FileText, Globe, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ModelSelector } from '@/components/chat/model-selector'
import { cn, formatBytes } from '@/lib/utils'
import { useChatStore } from '@/store/chat.store'
import { api } from '@/lib/api'
import toast from 'react-hot-toast'

interface UploadedFile {
  id: string
  name: string
  size: number
  mimeType: string
  publicUrl?: string
  status: string
}

interface ChatInputProps {
  onSend?: (content: string, attachmentIds: string[]) => Promise<boolean | void>
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const { isStreaming, sendMessage, stopStreaming } = useChatStore()
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Keyboard shortcut: Ctrl+K / Cmd+K for search (bubble up)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        // Dispatch custom event for sidebar search
        window.dispatchEvent(new CustomEvent('open-search'))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = useCallback(async () => {
    const content = value.trim()
    if (!content || isStreaming) return

    const attachmentIds = attachments.map((a) => a.id)

    try {
      const result = onSend
        ? await onSend(content, attachmentIds)
        : await sendMessage(content, attachmentIds)

      if (result !== false) {
        setValue('')
        setAttachments([])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Send failed'
      toast.error(message)
    } finally {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [value, isStreaming, attachments, onSend, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)

    try {
      const formData = new FormData()
      for (const file of Array.from(files)) {
        formData.append('files', file)
      }

      const { data } = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setAttachments((prev) => [...prev, ...(data.data ?? [])])
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      toast.error(message)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileUpload(e.dataTransfer.files)
  }, [])

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  const handleVoiceRecord = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop()
      setIsRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())

        // Send to OpenAI Whisper via API
        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')

        try {
          const { data } = await api.post('/chat/stt', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data.data?.text) {
            setValue((prev) => prev + (prev ? ' ' : '') + data.data.text)
            textareaRef.current?.focus()
          }
        } catch {
          toast.error('Voice transcription failed')
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const canSend = value.trim().length > 0 && !disabled

  return (
    <TooltipProvider>
      <div className="w-full">
        {/* Attachment previews */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2 mb-2 px-1"
            >
              {attachments.map((att) => (
                <AttachmentChip key={att.id} file={att} onRemove={removeAttachment} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main input container */}
        <div
          className={cn(
            'relative flex flex-col rounded-2xl border border-border bg-card transition-all duration-200',
            isDragOver && 'border-primary bg-primary/5',
            'focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20'
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {isDragOver && (
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-primary/10 z-10 pointer-events-none">
              <p className="text-primary font-medium text-sm">Drop files here</p>
            </div>
          )}

          {/* Toolbar top */}
          <div className="flex items-center gap-1 px-3 pt-2.5 pb-1">
            <ModelSelector />
            <div className="flex-1" />
          </div>

          {/* Textarea */}
          <div className="px-4 pb-2">
            <TextareaAutosize
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? 'Message aicraft...'}
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed min-h-[44px] max-h-[300px]"
              minRows={1}
              maxRows={10}
              disabled={disabled}
            />
          </div>

          {/* Bottom toolbar */}
          <div className="flex items-center gap-1 px-2 pb-2.5">
            {/* File upload */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || disabled}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {uploading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Attach file</TooltipContent>
            </Tooltip>

            {/* Voice input */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleVoiceRecord}
                  disabled={disabled}
                  className={cn(
                    'text-muted-foreground hover:text-foreground',
                    isRecording && 'text-red-500 hover:text-red-400 animate-pulse'
                  )}
                >
                  {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? 'Stop recording' : 'Voice input'}</TooltipContent>
            </Tooltip>

            <div className="flex-1" />

            {/* Character count */}
            {value.length > 500 && (
              <span className={cn('text-xs', value.length > 100000 ? 'text-destructive' : 'text-muted-foreground')}>
                {value.length.toLocaleString()}
              </span>
            )}

            {/* Send / Stop */}
            {isStreaming ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={stopStreaming}
                    size="icon-sm"
                    variant="secondary"
                    className="h-8 w-8 rounded-xl"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stop generating</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSend}
                    size="icon-sm"
                    className={cn(
                      'h-8 w-8 rounded-xl transition-all duration-200',
                      canSend
                        ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20'
                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Send message</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.docx,.doc,.txt,.csv,.xlsx,.xls,.json,.md"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />

        {/* Bottom hint */}
        <p className="text-center text-xs text-muted-foreground/40 mt-1.5 hidden md:block">
          aicraft can make mistakes. Verify important information.
        </p>
      </div>
    </TooltipProvider>
  )
}

function AttachmentChip({
  file,
  onRemove,
}: {
  file: UploadedFile
  onRemove: (id: string) => void
}) {
  const isImage = file.mimeType.startsWith('image/')
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-2.5 py-1.5 text-xs"
    >
      {isImage ? (
        <ImageIcon className="h-3.5 w-3.5 text-blue-400 shrink-0" />
      ) : (
        <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
      )}
      <span className="max-w-[100px] truncate text-foreground">{file.name}</span>
      <span className="text-muted-foreground">{formatBytes(file.size)}</span>
      {file.status === 'processing' && (
        <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
      )}
      <button
        type="button"
        onClick={() => onRemove(file.id)}
        className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  )
}
