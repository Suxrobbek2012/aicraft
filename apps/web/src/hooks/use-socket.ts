'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import { getAccessToken } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3010'

let globalSocket: Socket | null = null

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) return

    const token = getAccessToken()
    if (!token) return

    if (!globalSocket || !globalSocket.connected) {
      globalSocket = io(WS_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })
    }

    socketRef.current = globalSocket

    return () => {
      // Don't disconnect on component unmount — keep global connection
    }
  }, [isAuthenticated])

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('join:conversation', conversationId)
  }, [])

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leave:conversation', conversationId)
  }, [])

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler)
    return () => { socketRef.current?.off(event, handler) }
  }, [])

  return { socket: socketRef.current, joinConversation, leaveConversation, on }
}
