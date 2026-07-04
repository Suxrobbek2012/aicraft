import { Redis } from 'ioredis'
import { config } from '../config'
import { logger } from './logger'

let redisInstance: Redis | null = null

export function getRedis(): Redis {
  if (!redisInstance) {
    redisInstance = new Redis(config.REDIS_URL, {
      password: config.REDIS_PASSWORD || undefined,
      // BullMQ (via ioredis) requires: maxRetriesPerRequest must be null
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => {
        if (times > 10) return null
        return Math.min(times * 200, 5000)
      },
      reconnectOnError: (err) => {
        logger.error({ err }, 'Redis connection error')
        return true
      },
      lazyConnect: true,
    })


    redisInstance.on('connect', () => logger.info('✅ Redis connected'))
    redisInstance.on('error', (err) => logger.error({ err }, 'Redis error'))
    redisInstance.on('close', () => logger.warn('Redis connection closed'))
  }
  return redisInstance
}

export const CACHE_PREFIX = {
  USER: 'user:',
  SESSION: 'session:',
  RATE_LIMIT: 'rl:',
  CONVERSATION: 'conv:',
  MODELS: 'models:',
  API_KEY: 'apikey:',
  TOKEN_COUNT: 'tokens:',
  SETTINGS: 'settings:',
  OTP: 'otp:',
} as const

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  const value = await redis.get(key)
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const redis = getRedis()
  const serialized = JSON.stringify(value)
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized)
  } else {
    await redis.set(key, serialized)
  }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis()
  await redis.del(key)
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  const redis = getRedis()
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}

export async function incrementCounter(
  key: string,
  ttlSeconds: number
): Promise<number> {
  const redis = getRedis()
  const count = await redis.incr(key)
  if (count === 1) {
    await redis.expire(key, ttlSeconds)
  }
  return count
}
