import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { pool as defaultWritePool } from './pool';

dotenv.config();

// Redis connection for tracking distributed user-write timestamps
const redis = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.connect().catch((err) => {
  console.warn('[DBRouter] Redis unavailable for replication lag tracking, falling back to in-memory map:', err.message);
});

// In-memory fallback map for user write timestamps
const localWriteTimestamps = new Map<string, number>();

/**
 * Replication lag protection window in milliseconds.
 * Writes within the last 5 seconds force subsequent reads to the Primary pool
 * to guarantee Read-Your-Own-Writes consistency.
 */
export const REPLICATION_LAG_WINDOW_MS = parseInt(
  process.env.REPLICATION_LAG_WINDOW_MS || '5000',
  10
);

/**
 * Primary (Writer) Pool.
 */
export const primaryPool: Pool = defaultWritePool;

/**
 * Read Replica Pool.
 * Connects to DATABASE_REPLICA_URL if configured; otherwise gracefully points to primaryPool.
 */
export const replicaPool: Pool = process.env.DATABASE_REPLICA_URL
  ? new Pool({
      connectionString: process.env.DATABASE_REPLICA_URL,
      max: parseInt(process.env.DB_REPLICA_POOL_MAX || '15', 10),
      min: 2,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : defaultWritePool;

replicaPool.on('error', (err) => {
  console.error('[DBRouter] Unexpected error on replica pool client:', err);
});

/**
 * Records that a user has executed a database mutation.
 * Stores in Redis with an expiration of 2x the lag window.
 */
export async function recordUserWrite(userId: string): Promise<void> {
  const now = Date.now();
  localWriteTimestamps.set(userId, now);

  try {
    if (redis.status === 'ready') {
      const ttlSec = Math.ceil((REPLICATION_LAG_WINDOW_MS * 2) / 1000);
      await redis.set(`user_last_write:${userId}`, now.toString(), 'EX', ttlSec);
    }
  } catch (err: any) {
    console.warn(`[DBRouter] Failed to set user write timestamp in Redis for ${userId}:`, err.message);
  }
}

/**
 * Checks whether a user is within the replication lag protection window.
 */
export async function isWithinReplicationLag(userId: string): Promise<boolean> {
  const now = Date.now();

  try {
    if (redis.status === 'ready') {
      const val = await redis.get(`user_last_write:${userId}`);
      if (val) {
        const lastWrite = parseInt(val, 10);
        if (now - lastWrite < REPLICATION_LAG_WINDOW_MS) {
          return true;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[DBRouter] Failed to read user write timestamp from Redis for ${userId}:`, err.message);
  }

  // Fallback to local memory map
  const localVal = localWriteTimestamps.get(userId);
  if (localVal && now - localVal < REPLICATION_LAG_WINDOW_MS) {
    return true;
  }

  return false;
}

/**
 * Detects whether a SQL query is a mutation or transaction control.
 */
export function isWriteSql(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase();
  return (
    trimmed.startsWith('INSERT') ||
    trimmed.startsWith('UPDATE') ||
    trimmed.startsWith('DELETE') ||
    trimmed.startsWith('CREATE') ||
    trimmed.startsWith('ALTER') ||
    trimmed.startsWith('DROP') ||
    trimmed.startsWith('TRUNCATE') ||
    trimmed.startsWith('BEGIN') ||
    trimmed.startsWith('COMMIT') ||
    trimmed.startsWith('ROLLBACK') ||
    trimmed.startsWith('SELECT ... FOR UPDATE') ||
    trimmed.includes('FOR UPDATE')
  );
}

export type DbRouteTarget = 'PRIMARY' | 'REPLICA';

export interface RouteOptions {
  userId?: string;
  forcePrimary?: boolean;
}

export interface RoutedQueryResult<T extends QueryResultRow = any> {
  result: QueryResult<T>;
  target: DbRouteTarget;
  reason: 'WRITE_OPERATION' | 'REPLICATION_LAG_PROTECTION' | 'FORCE_PRIMARY' | 'REPLICA_READ';
}

/**
 * Intelligent Database Router:
 * - Directs write queries to the Primary.
 * - Directs reads to Primary if user recently wrote within the replication lag window (Read-Your-Own-Writes).
 * - Directs standard reads to the Read Replica pool.
 */
export async function queryRouted<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[],
  options?: RouteOptions
): Promise<RoutedQueryResult<T>> {
  const isWrite = isWriteSql(text);

  if (isWrite) {
    const res = await primaryPool.query<T>(text, params);
    if (options?.userId) {
      await recordUserWrite(options.userId);
    }
    return {
      result: res,
      target: 'PRIMARY',
      reason: 'WRITE_OPERATION',
    };
  }

  if (options?.forcePrimary) {
    const res = await primaryPool.query<T>(text, params);
    return {
      result: res,
      target: 'PRIMARY',
      reason: 'FORCE_PRIMARY',
    };
  }

  if (options?.userId) {
    const inLagWindow = await isWithinReplicationLag(options.userId);
    if (inLagWindow) {
      const res = await primaryPool.query<T>(text, params);
      return {
        result: res,
        target: 'PRIMARY',
        reason: 'REPLICATION_LAG_PROTECTION',
      };
    }
  }

  const res = await replicaPool.query<T>(text, params);
  return {
    result: res,
    target: 'REPLICA',
    reason: 'REPLICA_READ',
  };
}

/**
 * Express middleware to automatically record writes for mutating HTTP requests.
 */
export function readYourOwnWritesMiddleware() {
  return async (req: any, res: any, next: any) => {
    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase());

    if (isMutatingMethod) {
      res.on('finish', async () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const userId = req.user?.id || req.user?.userId;
          if (userId) {
            await recordUserWrite(userId);
          }
        }
      });
    }

    // Attach routed query helper to request
    req.db = {
      query: (text: string, params?: unknown[], forcePrimary?: boolean) =>
        queryRouted(text, params, {
          userId: req.user?.id || req.user?.userId,
          forcePrimary,
        }),
    };

    next();
  };
}
