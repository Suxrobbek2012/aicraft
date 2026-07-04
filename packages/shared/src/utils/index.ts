/**
 * Generate a random ID using crypto
 */
export function generateId(length = 21): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  for (const byte of array) {
    result += chars[byte % chars.length]
  }
  return result
}

/**
 * Truncate text to a maximum number of characters
 */
export function truncate(text: string, maxLength: number, suffix = '...'): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - suffix.length) + suffix
}

/**
 * Format file size to human-readable string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

/**
 * Format number with K/M/B suffixes
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toString()
}

/**
 * Calculate token cost in USD
 */
export function calculateTokenCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMillion: number,
  outputPricePerMillion: number
): number {
  return (
    (inputTokens * inputPricePerMillion) / 1_000_000 +
    (outputTokens * outputPricePerMillion) / 1_000_000
  )
}

/**
 * Slugify a string
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Sleep for a given number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 10000 } = options
  let lastError: Error | unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Deep merge two objects
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target }
  for (const key in source) {
    if (source[key] !== undefined) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        source[key] !== null &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key]) &&
        target[key] !== null
      ) {
        result[key] = deepMerge(
          target[key] as Record<string, unknown>,
          source[key] as Record<string, unknown>
        ) as T[typeof key]
      } else {
        result[key] = source[key] as T[typeof key]
      }
    }
  }
  return result
}

/**
 * Extract text content from markdown
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/>\s/g, '')
    .trim()
}

/**
 * Detect language from text (basic heuristic)
 */
export function detectLanguage(text: string): string {
  const patterns: Record<string, RegExp> = {
    uz: /\b(?:salom|rahmat|qalesan|qanday|yo'q|yoq|ha|yo‘q|rahmat|салом|рахмат|қандай)\b/i,
    ru: /[а-яёА-ЯЁ]/,
    ar: /[\u0600-\u06FF]/,
    zh: /[\u4E00-\u9FFF]/,
    ja: /[\u3040-\u309F\u30A0-\u30FF]/,
    ko: /[\uAC00-\uD7AF]/,
    de: /[äöüÄÖÜß]/,
    fr: /[àâæçéèêëîïôùûüÿœÀÂÆÇÉÈÊËÎÏÔÙÛÜŸŒ]/,
    tr: /[şğüöıçŞĞÜÖİÇ]/,
  }

  for (const [lang, pattern] of Object.entries(patterns)) {
    if (pattern.test(text)) return lang
  }

  return 'en'
}

/**
 * Generate a conversation title from first message
 */
export function generateConversationTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim().replace(/\n+/g, ' ')
  return truncate(cleaned, 50)
}

/**
 * Validate UUID v4
 */
export function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str)
}

/**
 * Mask an API key for display
 */
export function maskApiKey(key: string): string {
  if (key.length <= 8) return '***'
  return key.slice(0, 4) + '***' + key.slice(-4)
}
