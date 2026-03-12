/**
 * Simple in-memory rate limiter. No Redis required.
 * Uses a Map of IP → timestamps[].
 */

const requestMap = new Map<string, number[]>();

const WINDOW_MS = 60_000; // 1 minute window
const MAX_REQUESTS = 20;  // 20 requests per window

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestMap.entries()) {
    const valid = timestamps.filter(t => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requestMap.delete(key);
    } else {
      requestMap.set(key, valid);
    }
  }
}, 5 * 60_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * Check if the given key (usually IP) is within rate limits.
 * Call this at the top of your API route handler.
 */
export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const timestamps = requestMap.get(key) || [];

  // Remove timestamps outside the window
  const valid = timestamps.filter(t => now - t < WINDOW_MS);

  if (valid.length >= MAX_REQUESTS) {
    const oldestInWindow = valid[0];
    const retryAfterMs = WINDOW_MS - (now - oldestInWindow);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  valid.push(now);
  requestMap.set(key, valid);

  return { allowed: true, remaining: MAX_REQUESTS - valid.length };
}

/**
 * Helper: extract client IP from Next.js request headers.
 */
export function getClientIP(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
