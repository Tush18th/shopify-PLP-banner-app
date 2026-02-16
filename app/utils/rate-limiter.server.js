/**
 * Simple in-memory rate limiter for public endpoints.
 * In production, replace with Redis-backed implementation.
 */
const requestCounts = new Map();

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 120; // per window per IP

/**
 * Check if a request should be rate-limited.
 * Returns { limited: boolean, remaining: number }
 */
export function checkRateLimit(identifier) {
  const now = Date.now();
  const key = identifier;

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return { limited: false, remaining: MAX_REQUESTS - 1 };
  }

  const entry = requestCounts.get(key);

  // Reset window if expired
  if (now - entry.windowStart > WINDOW_MS) {
    entry.count = 1;
    entry.windowStart = now;
    return { limited: false, remaining: MAX_REQUESTS - 1 };
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: MAX_REQUESTS - entry.count };
}

// Periodically clean up stale entries (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (now - entry.windowStart > WINDOW_MS * 2) {
      requestCounts.delete(key);
    }
  }
}, 300_000);
