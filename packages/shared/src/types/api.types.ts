export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
  requestId?: string
}

export interface ApiMeta {
  page?: number
  pageSize?: number
  total?: number
  totalPages?: number
  cursor?: string
  hasNextPage?: boolean
  hasPrevPage?: boolean
}

export interface PaginationParams {
  page?: number
  pageSize?: number
  cursor?: string
}

export interface SortParams {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface SearchParams extends PaginationParams, SortParams {
  q?: string
  filters?: Record<string, string | number | boolean | string[]>
}

export type ApiKey = {
  id: string
  userId: string
  workspaceId?: string | null
  name: string
  keyPrefix: string
  scopes: ApiKeyScope[]
  rateLimit: number
  rateLimitWindow: number
  totalRequests: number
  lastUsedAt?: Date | null
  expiresAt?: Date | null
  isActive: boolean
  createdAt: Date
}

export type ApiKeyScope =
  | 'chat:read'
  | 'chat:write'
  | 'files:read'
  | 'files:write'
  | 'models:read'
  | 'usage:read'
  | 'admin:read'
  | 'admin:write'

export interface WebhookEvent {
  id: string
  type: string
  payload: unknown
  createdAt: Date
}

export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: number
  retryAfter?: number
}

export interface TokenUsage {
  userId: string
  period: 'day' | 'month' | 'total'
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  updatedAt: Date
}
