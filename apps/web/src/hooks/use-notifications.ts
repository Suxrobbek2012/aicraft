'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useNotifications() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await api.get('/notifications', { params: { pageSize: 20 } })
      return data as {
        data: Array<{ id: string; type: string; title: string; body: string; isRead: boolean; createdAt: string }>
        meta: { unreadCount: number }
      }
    },
    refetchInterval: 30_000, // Poll every 30s
  })

  const markRead = useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return {
    notifications: data?.data ?? [],
    unreadCount: data?.meta?.unreadCount ?? 0,
    isLoading,
    markRead: markRead.mutate,
    markAllRead: markAllRead.mutate,
  }
}
