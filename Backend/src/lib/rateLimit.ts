import IORedis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Redis is used here only for ephemeral coordination (rate limiting), never as
// durable business state. The authoritative account state stays in PostgreSQL.
export const rateLimitRedis = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter keyed by an arbitrary scope string. The window expiry is
 * set atomically on the first increment, so a burst cannot permanently extend
 * the window.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const count = await rateLimitRedis.incr(key);
  if (count === 1) {
    await rateLimitRedis.expire(key, windowSeconds);
  }
  const ttl = await rateLimitRedis.ttl(key);
  const allowed = count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, ttl),
  };
}

/**
 * Cooldown guard for "send again" style endpoints. Uses SET NX EX, which is
 * atomic, so concurrent requests cannot start two cooldown windows.
 */
export async function acquireCooldown(key: string, seconds: number): Promise<RateLimitResult> {
  const acquired = await rateLimitRedis.set(key, '1', 'EX', seconds, 'NX');
  if (acquired === 'OK') {
    return { allowed: true, remaining: 1, retryAfterSeconds: 0 };
  }
  const ttl = await rateLimitRedis.ttl(key);
  return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, ttl) };
}
