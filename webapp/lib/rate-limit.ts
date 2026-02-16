/**
 * Rate limiter with Upstash Redis support
 * Falls back to in-memory if Redis is not configured
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from './logger'

const log = logger.child({ module: 'rate-limit' })

// Initialize Redis client if configured
let redis: Redis | null = null
let useRedis = false

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    useRedis = true
    log.info('Redis rate limiter initialized')
  } catch (error) {
    log.warn('Failed to initialize Redis rate limiter, using in-memory fallback', { error })
  }
}

// In-memory fallback
interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries periodically (only for in-memory)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    rateLimitStore.forEach((entry, key) => {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key)
      }
    })
  }, 60000)
}

export interface RateLimitConfig {
  limit: number
  windowSeconds: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Create Upstash rate limiters for each config
const rateLimiters = new Map<string, Ratelimit>()

function getOrCreateRateLimiter(configKey: string, config: RateLimitConfig): Ratelimit | null {
  if (!redis) return null

  const key = `${configKey}:${config.limit}:${config.windowSeconds}`
  if (!rateLimiters.has(key)) {
    rateLimiters.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.limit, `${config.windowSeconds} s`),
        analytics: true,
        prefix: 'acc:ratelimit',
      })
    )
  }
  return rateLimiters.get(key)!
}

/**
 * Check rate limit for a given identifier
 * Uses Redis if available, falls back to in-memory
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig,
  configKey: string = 'default'
): Promise<RateLimitResult> {
  // Try Redis first
  if (useRedis) {
    const limiter = getOrCreateRateLimiter(configKey, config)
    if (limiter) {
      try {
        const result = await limiter.limit(identifier)
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: Math.ceil(result.reset / 1000),
        }
      } catch (error) {
        log.warn('Redis rate limit check failed, falling back to in-memory', { error })
      }
    }
  }

  // Fallback to in-memory
  return checkRateLimitSync(identifier, config)
}

/**
 * Synchronous in-memory rate limit check (fallback)
 */
function checkRateLimitSync(identifier: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  let entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetTime < now) {
    entry = {
      count: 0,
      resetTime: now + windowMs,
    }
  }

  entry.count++
  rateLimitStore.set(identifier, entry)

  const remaining = Math.max(0, config.limit - entry.count)
  const success = entry.count <= config.limit

  return {
    success,
    limit: config.limit,
    remaining,
    reset: Math.ceil(entry.resetTime / 1000),
  }
}

/**
 * Sync version for backwards compatibility
 * Note: Prefers async version for Redis support
 */
export function checkRateLimit(identifier: string, config: RateLimitConfig): RateLimitResult {
  // For sync calls, only use in-memory
  return checkRateLimitSync(identifier, config)
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  return 'unknown'
}

// Preset configurations
export const RATE_LIMITS = {
  sessionUpload: { limit: 10, windowSeconds: 3600 },
  commitLink: { limit: 50, windowSeconds: 3600 },
  deviceCode: { limit: 5, windowSeconds: 3600 },
  apiKeyCreate: { limit: 10, windowSeconds: 3600 },
  general: { limit: 100, windowSeconds: 60 },
} as const

export type RateLimitType = keyof typeof RATE_LIMITS
