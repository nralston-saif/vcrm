/**
 * In-memory rate limiter for API routes
 */

interface RateLimitRecord {
  count: number
  resetTime: number
}

const rateLimitMap = new Map<string, RateLimitRecord>()

/**
 * Check if a request is allowed based on rate limiting
 * @param key - Unique identifier (usually IP address)
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  // Clean up old entries periodically (every ~1% of checks)
  if (Math.random() < 0.01) {
    for (const [mapKey, value] of rateLimitMap.entries()) {
      if (now > value.resetTime) {
        rateLimitMap.delete(mapKey)
      }
    }
  }

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1 }
  }

  if (record.count >= maxRequests) {
    return { allowed: false, remaining: 0 }
  }

  record.count++
  return { allowed: true, remaining: maxRequests - record.count }
}

/**
 * Get the client IP address from a request
 * @param headers - Request headers
 * @returns IP address string
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
