import { Request, Response, NextFunction } from 'express';
import { rateLimit } from '../lib/rateLimit';

export interface RateLimitOptions {
  prefix: string;
  limit: number;
  windowSeconds: number;
  keyGenerator?: (req: Request) => string;
}

/**
 * Express middleware for Redis-backed rate limiting.
 * Returns HTTP 429 with RATE_LIMIT_EXCEEDED when limits are exceeded.
 */
export function redisRateLimiter(options: RateLimitOptions) {
  const { prefix, limit, windowSeconds, keyGenerator } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const clientIp =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown_ip';

      const suffix = keyGenerator ? keyGenerator(req) : clientIp;
      const key = `ratelimit:${prefix}:${suffix}`;

      const result = await rateLimit(key, limit, windowSeconds);

      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());

      if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfterSeconds.toString());
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
            details: {
              retryAfterSeconds: result.retryAfterSeconds,
            },
          },
        });
        return;
      }

      next();
    } catch (err) {
      // Ephemeral Redis rate limiting should not crash core API requests if Redis hiccups
      console.error('Rate limiting error:', err);
      next();
    }
  };
}
