'use client'

import React, { useEffect, useState } from 'react'
import { Check, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useChatStore } from '@/store/chat.store'
import { cn, getModelDisplayName, getModelIcon, getProviderName, isSameModelId } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Model {
  modelId: string
  name: string
  provider: string
  contextWindow: number
  supportsVision: boolean
  supportsTools: boolean
  inputPricePerMillion: number
  outputPricePerMillion: number
  description?: string
  capabilities: string[]
}

export function ModelSettings() {
  const { selectedModel, setSelectedModel } = useChatStore()
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/models')
      .then(({ data }) => setModels(data.data ?? []))
      .finally(() => setLoading(false))
  }, [])

  const ollamaModels = models.filter((m) => m.provider === 'ollama')
  const grouped = ollamaModels.reduce<Record<string, Model[]>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = []
    acc[m.provider].push(m)
    return acc
  }, {})

  const handleSelect = async (model: Model) => {
    setSelectedModel(model.modelId, model.provider)
    try {
      await api.patch('/users/me/settings', {
        defaultModel: model.modelId,
        defaultProvider: model.provider,
      })
      toast.success(`Default model set to ${model.provider === 'ollama' ? getModelDisplayName(model.modelId) : model.name}`)
    } catch {
      toast.error('Failed to save model preference')
    }
  }

  if (loading) {
    return <div className="space-y-3">{[...Array(6)].map((_, i) => (
      <div key={i} className="h-20 rounded-xl bg-secondary/40 animate-pulse" />
    ))}</div>
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">AI Models</h2>
        <p className="text-sm text-muted-foreground">Choose your default AI model</p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{getModelIcon(provider)}</span>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {getProviderName(provider)}
              </h3>
            </div>
            <div className="space-y-2">
              {providerModels.map((model) => {
                const isSelected = isSameModelId(model.modelId, selectedModel)
                const modelName = model.provider === 'ollama'
                  ? getModelDisplayName(model.modelId)
                  : model.name
                return (
                  <button
                    key={model.modelId}
                    onClick={() => handleSelect(model)}
                    className={cn(
                      'w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/30 hover:bg-secondary/50'
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{modelName}</span>
                        {model.supportsVision && <Badge variant="outline" className="text-xs py-0">Vision</Badge>}
                        {model.supportsTools && <Badge variant="outline" className="text-xs py-0">Tools</Badge>}
                        {model.inputPricePerMillion === 0 && <Badge variant="green" className="text-xs py-0">Free</Badge>}
                      </div>
                      {model.description && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{model.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {(model.contextWindow / 1000).toFixed(0)}K context
                        {model.inputPricePerMillion > 0 && (
                          <> · ${model.inputPricePerMillion}/M input tokens</>
                        )}
                      </p>
                    </div>
                    {selectedModel === model.modelId && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
