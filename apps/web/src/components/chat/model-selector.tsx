'use client'

import React, { useEffect, useState } from 'react'
import { ChevronDown, Check, Eye, Wrench, Wifi } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useChatStore } from '@/store/chat.store'
import {
  getModelDisplayName,
  getModelIcon,
  getProviderName,
  isSameModelId,
} from '@/lib/utils'

interface AIModel {
  modelId: string
  name: string
  provider: string
  supportsVision: boolean
  supportsTools: boolean
  inputPricePerMillion: number
  description?: string
  capabilities: string[]
}

interface GroupedModels {
  [provider: string]: AIModel[]
}

export function ModelSelector() {
  const { selectedModel, selectedProvider, setSelectedModel } = useChatStore()

  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    const loadModels = async () => {
      try {
        if (!api || typeof api.get !== 'function') {
          console.error('API client is undefined')
          return
        }

        const response = await api.get('/models')

        if (mounted) {
          setModels(response?.data?.data ?? [])
        }
      } catch (err) {
        console.error(err)

        if (mounted) {
          setModels([])
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadModels()

    return () => {
      mounted = false
    }
  }, [])

  const ollamaModels = models.filter((model) => model.provider === 'ollama')

  const grouped = ollamaModels.reduce<GroupedModels>((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }

    acc[model.provider].push(model)

    return acc
  }, {})

  const currentModel = models.find((m) =>
    isSameModelId(m.modelId, selectedModel)
  )

  const displayName = currentModel
    ? currentModel.provider === 'ollama'
      ? getModelDisplayName(currentModel.modelId)
      : currentModel.name
    : getModelDisplayName(selectedModel)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="h-8 gap-1.5 px-2 rounded-xl"
        >
          <span>{getModelIcon(selectedProvider)}</span>
          <span className="truncate max-w-[140px]">{displayName}</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 max-h-96 overflow-y-auto"
      >
        {Object.entries(grouped).map(([provider, providerModels]) => (
          <React.Fragment key={provider}>
            <DropdownMenuLabel className="flex items-center gap-2">
              <span>{getModelIcon(provider)}</span>
              <span>{getProviderName(provider)}</span>

              {provider === 'ollama' && (
                <Badge variant="green" className="ml-auto">
                  Local
                </Badge>
              )}
            </DropdownMenuLabel>

            {providerModels.map((model) => {
              const modelName =
                model.provider === 'ollama'
                  ? getModelDisplayName(model.modelId)
                  : model.name

              return (
                <DropdownMenuItem
                  key={model.modelId}
                  onClick={() =>
                    setSelectedModel(model.modelId, model.provider)
                  }
                  className="cursor-pointer py-2.5"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span>{modelName}</span>

                      {model.modelId === selectedModel && (
                        <Check className="h-4 w-4" />
                      )}
                    </div>

                    {model.description && (
                      <p className="text-xs text-muted-foreground">
                        {model.description}
                      </p>
                    )}

                    <div className="flex gap-2 mt-1">
                      {model.supportsVision && (
                        <span className="flex items-center gap-1 text-xs">
                          <Eye className="h-3 w-3" />
                          Vision
                        </span>
                      )}

                      {model.supportsTools && (
                        <span className="flex items-center gap-1 text-xs">
                          <Wrench className="h-3 w-3" />
                          Tools
                        </span>
                      )}

                      {model.capabilities.includes('search') && (
                        <span className="flex items-center gap-1 text-xs">
                          <Wifi className="h-3 w-3" />
                          Search
                        </span>
                      )}

                      {model.inputPricePerMillion === 0 && (
                        <Badge variant="green">Free</Badge>
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              )
            })}

            <DropdownMenuSeparator />
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}