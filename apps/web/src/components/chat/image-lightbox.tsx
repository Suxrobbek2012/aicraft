'use client'

import React, { useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImageLightboxProps {
  src: string
  alt: string
  open: boolean
  onClose: () => void
}

/**
 * Rasmni kattalashtirib ko'rish uchun lightbox modal
 */
export function ImageLightbox({ src, alt, open, onClose }: ImageLightboxProps) {
  const [scale, setScale] = React.useState(1)

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, handleKeyDown])

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                setScale((s) => Math.min(s + 0.5, 3))
              }}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                setScale((s) => Math.max(s - 0.5, 0.5))
              }}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <a
              href={src}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant="secondary"
                size="icon-sm"
                className="bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <Download className="h-4 w-4" />
              </Button>
            </a>
            <Button
              variant="secondary"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="bg-black/50 hover:bg-black/70 text-white rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Image */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              style={{ transform: `scale(${scale})` }}
              className="rounded-xl max-w-full max-h-[85vh] object-contain transition-transform duration-200"
              draggable={false}
            />
          </motion.div>

          {/* Alt text */}
          {alt && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70 bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm max-w-md truncate">
              {alt}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
