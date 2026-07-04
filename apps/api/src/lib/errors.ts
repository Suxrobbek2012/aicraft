import { ERROR_CODES, type ErrorCode } from '@go-ai/shared'

export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: ErrorCode
  public readonly details?: unknown

  constructor(message: string, statusCode = 500, code: ErrorCode = ERROR_CODES.INTERNAL_ERROR, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
    Error.captureStackTrace(this, this.constructor)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, ERROR_CODES.UNAUTHORIZED)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, ERROR_CODES.FORBIDDEN)
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, ERROR_CODES.VALIDATION_ERROR, details)
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, ERROR_CODES.RATE_LIMIT_EXCEEDED)
  }
}

export class PlanLimitError extends AppError {
  constructor(message: string) {
    super(message, 403, ERROR_CODES.PLAN_LIMIT_EXCEEDED)
  }
}

export class InsufficientTokensError extends AppError {
  constructor() {
    super('Insufficient token balance', 402, ERROR_CODES.INSUFFICIENT_TOKENS)
  }
}

export class AIProviderError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, ERROR_CODES.AI_PROVIDER_ERROR, details)
  }
}

export class FeatureNotAvailableError extends AppError {
  constructor(feature: string, requiredPlan: string) {
    super(
      `"${feature}" requires ${requiredPlan} plan or higher`,
      403,
      ERROR_CODES.FEATURE_NOT_AVAILABLE
    )
  }
}
