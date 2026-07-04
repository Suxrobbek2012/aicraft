import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string, format = 'relative'): string {
  const d = new Date(date)
  if (format === 'relative') {
    const now = Date.now()
    const diff = now - d.getTime()
    if (diff < 60_000) return 'just now'
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString()
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function getProviderColor(provider: string): string {
  const colors: Record<string, string> = {
    openai: 'text-emerald-400',
    anthropic: 'text-orange-400',
    google: 'text-blue-400',
    xai: 'text-purple-400',
    perplexity: 'text-cyan-400',
    ollama: 'text-go-green-400',
  }
  return colors[provider] ?? 'text-muted-foreground'
}

export function getProviderName(provider: string): string {
  const names: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    perplexity: 'Perplexity',
    ollama: 'Aicraft',
  }
  return names[provider] ?? provider
}

export function getModelIcon(provider: string): string {
  const icons: Record<string, string> = {
    openai: '🟢',
    anthropic: '🟠',
    google: '🔵',
    xai: '🟣',
    perplexity: '🔷',
    ollama: '✦',
  }
  return icons[provider] ?? '✦'
}

export function normalizeModelId(modelId: string): string {
  return modelId.replace(/^ollama\//, '')
}

export function isSameModelId(a: string, b: string): boolean {
  return normalizeModelId(a) === normalizeModelId(b)
}

export function getModelDisplayName(modelId: string): string {
  const normalized = normalizeModelId(modelId)
  if (normalized.includes('llama3.2:1b')) return 'Aicraft Mini'
  // if (normalized.includes('llama3.2:3b')) return 'Aicraft'
  if (normalized.includes('llama3.2')) return 'Aicraft'
  if (normalized.includes('llama3.1')) return 'Aicraft Pro'
  if (normalized.includes('llama')) return 'Aicraft'
  return normalized
}

export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

export function truncateText(text: string, length = 50): string {
  if (text.length <= length) return text
  return text.slice(0, length) + '...'
}
