import Redis from "ioredis";

// ── Redis client (lazy singleton) ───────────────────────────────────────────

/** @type {Redis | null} */
let redis = null;
let redisAvailable = true;

function getRedisClient() {
  if (redis) return redis;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    redisAvailable = false;
    console.warn(
      "REDIS_URL not configured — falling back to in-memory rate limiter. " +
      "This is NOT safe for multi-instance deployments."
    );
    return null;
  }

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > 3) return null; // Stop retrying after 3 attempts
      return Math.min(times * 200, 2000);
    },
  });

  redis.on("error", (err) => {
    console.error("Redis connection error:", err.message);
    redisAvailable = false;
  });

  redis.on("connect", () => {
    redisAvailable = true;
  });

  redis.connect().catch(() => {
    redisAvailable = false;
  });

  return redis;
}

// ── Configuration defaults ──────────────────────────────────────────────────

const DEFAULT_WINDOW_MS = 60_000; // 1 minute
const DEFAULT_MAX_REQUESTS = 120; // per window

// ── In-memory fallback (for graceful degradation) ───────────────────────────

const memoryStore = new Map();

function checkRateLimitMemory(identifier, maxRequests, windowMs) {
  const now = Date.now();

  if (!memoryStore.has(identifier)) {
    memoryStore.set(identifier, { count: 1, windowStart: now });
    return { limited: false, remaining: maxRequests - 1 };
  }

  const entry = memoryStore.get(identifier);

  if (now - entry.windowStart > windowMs) {
    entry.count = 1;
    entry.windowStart = now;
    return { limited: false, remaining: maxRequests - 1 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0 };
  }

  return { limited: false, remaining: maxRequests - entry.count };
}

// Periodically clean up stale in-memory entries
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (now - entry.windowStart > DEFAULT_WINDOW_MS * 5) {
      memoryStore.delete(key);
    }
  }
}, 300_000).unref();

// ── Redis-backed fixed-window rate limiter ──────────────────────────────────

/**
 * Check if a request should be rate-limited.
 *
 * Uses Redis INCR + PEXPIRE for a fixed-window counter.
 * Falls back to in-memory if Redis is unavailable.
 *
 * @param {string} identifier - Unique key (e.g. IP address or "track:<ip>")
 * @param {{ windowMs?: number, maxRequests?: number }} options
 * @returns {Promise<{ limited: boolean, remaining: number }>}
 */
export async function checkRateLimit(identifier, options = {}) {
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;

  const client = getRedisClient();

  // Fallback to in-memory if Redis is not available
  if (!client || !redisAvailable) {
    return checkRateLimitMemory(identifier, maxRequests, windowMs);
  }

  const key = `rl:${identifier}`;

  try {
    const pipeline = client.pipeline();
    pipeline.incr(key);
    pipeline.pttl(key);
    const results = await pipeline.exec();

    const count = results[0][1];
    const ttl = results[1][1];

    // Set expiry on first request in the window
    if (ttl === -1 || ttl === -2) {
      await client.pexpire(key, windowMs);
    }

    if (count > maxRequests) {
      return { limited: true, remaining: 0 };
    }

    return { limited: false, remaining: maxRequests - count };
  } catch (err) {
    console.error("Redis rate limit error, falling back to memory:", err.message);
    redisAvailable = false;
    return checkRateLimitMemory(identifier, maxRequests, windowMs);
  }
}
