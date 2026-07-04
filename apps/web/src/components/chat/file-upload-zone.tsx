'use client'

import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, FileText, Image, X } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'

interface FileUploadZoneProps {
  onFiles: (files: File[]) => void
  accept?: Record<string, string[]>
  maxSize?: number
  children?: React.ReactNode
  className?: string
}

export function FileUploadZone({
  onFiles,
  accept,
  maxSize = 50 * 1024 * 1024,
  children,
  className,
}: FileUploadZoneProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFiles(acceptedFiles)
  }, [onFiles])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: accept ?? {
      'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxSize,
    noClick: !!children,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        'relative transition-all duration-200',
        isDragActive && !isDragReject && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        isDragReject && 'ring-2 ring-destructive',
        className
      )}
    >
      <input {...getInputProps()} />

      {children ?? (
        <div className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors',
          isDragActive && 'border-primary bg-primary/5'
        )}>
          <Upload className={cn('h-8 w-8 mb-3', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
          <p className="text-sm font-medium">
            {isDragActive ? 'Drop files here' : 'Drag & drop files'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, TXT, CSV, XLSX, Images up to {formatBytes(maxSize)}
          </p>
        </div>
      )}

      {isDragActive && children && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 rounded-2xl bg-primary/10 border-2 border-primary border-dashed z-10 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-sm font-semibold text-primary">Drop to upload</p>
          </div>
        </motion.div>
      )}
    </div>
  )
}
