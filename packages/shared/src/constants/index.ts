// Plan limits
export const PLAN_LIMITS = {
  FREE: {
    dailyMessages: -1,
    dailyTokens: -1,
    monthlyTokens: -1,
    maxFileSize: 100, // MB
    maxFilesPerMessage: 20,
    maxConversations: -1,
    contextWindow: 200_000,
    models: ['gpt-4o-mini', 'claude-3-haiku-20240307', 'gemini-1.5-flash', 'ollama/*'],
    features: {
      vision: false,
      fileUpload: true,
      voiceInput: false,
      tts: false,
      apiAccess: false,
      plugins: false,
      memory: false,
      customSystemPrompt: false,
    },
  },
  PRO: {
    dailyMessages: -1,
    dailyTokens: -1,
    monthlyTokens: -1,
    maxFileSize: 100, // MB
    maxFilesPerMessage: 20,
    maxConversations: -1,
    contextWindow: 200_000,
    models: ['gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-1.5-pro', 'grok-2', 'ollama/*'],
    features: {
      vision: true,
      fileUpload: true,
      voiceInput: true,
      tts: true,
      apiAccess: true,
      plugins: true,
      memory: true,
      customSystemPrompt: true,
    },
  },
  ULTRA: {
    dailyMessages: -1, // unlimited
    dailyTokens: -1,
    monthlyTokens: -1,
    maxFileSize: 100, // MB
    maxFilesPerMessage: 20,
    maxConversations: -1,
    contextWindow: 200_000,
    models: ['*'],
    features: {
      vision: true,
      fileUpload: true,
      voiceInput: true,
      tts: true,
      apiAccess: true,
      plugins: true,
      memory: true,
      customSystemPrompt: true,
    },
  },
} as const

// Token economy
export const TOKEN_PRICES = {
  FREE_MONTHLY: 0,
  PRO_MONTHLY: 20,
  ULTRA_MONTHLY: 100,
}

export const INTERNAL_TOKEN_VALUE = 0.000002 // $0.000002 per internal token

// Rate limiting
export const RATE_LIMITS = {
  FREE: {
    requestsPerMinute: 10,
    requestsPerHour: 60,
    requestsPerDay: 100,
  },
  PRO: {
    requestsPerMinute: 30,
    requestsPerHour: 500,
    requestsPerDay: 2000,
  },
  ULTRA: {
    requestsPerMinute: 100,
    requestsPerHour: 2000,
    requestsPerDay: -1,
  },
  API: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },
}

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  documents: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/json',
    'text/markdown',
    'text/html',
    'application/xml',
    'text/xml',
  ],
  audio: ['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg'],
  code: ['text/javascript', 'application/typescript', 'text/python', 'text/css'],
} as const

export const ALL_SUPPORTED_MIME_TYPES = [
  ...SUPPORTED_FILE_TYPES.images,
  ...SUPPORTED_FILE_TYPES.documents,
  ...SUPPORTED_FILE_TYPES.audio,
  ...SUPPORTED_FILE_TYPES.code,
]

// Default models per provider
export const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-3-5-sonnet-20241022',
  google: 'gemini-1.5-pro',
  xai: 'grok-2',
  perplexity: 'llama-3.1-sonar-large-128k-online',
  ollama: 'llama3.2',
}

// Error codes
export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_TOKENS: 'INSUFFICIENT_TOKENS',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_FILE_TYPE: 'UNSUPPORTED_FILE_TYPE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
  SUBSCRIPTION_REQUIRED: 'SUBSCRIPTION_REQUIRED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
}

// Cache TTL (seconds)
export const CACHE_TTL = {
  USER: 300,
  CONVERSATION: 60,
  MODELS: 3600,
  SETTINGS: 600,
  ANALYTICS: 300,
}
