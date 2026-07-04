'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface AIModel {
  modelId: string
  name: string
  provider: string
  contextWindow: number
  maxOutputTokens: number
  supportsVision: boolean
  supportsTools: boolean
  supportsStreaming: boolean
  inputPricePerMillion: number
  outputPricePerMillion: number
  isEnabled: boolean
  isDefault: boolean
  capabilities: string[]
  description?: string
}

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const { data } = await api.get('/models')
      return data.data as AIModel[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useProviders() {
  return useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      const { data } = await api.get('/models/providers')
      return data.data as Array<{ id: string; name: string; isAvailable: boolean }>
    },
    staleTime: 60 * 1000,
  })
}
