import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Connection Pool Configuration & Sizing Justification.
 *
 * POOL SIZE JUSTIFICATION:
 * ------------------------
 * 1. Hardware & OS Thread Model (HikariCP / PostgreSQL Empirical Formula):
 *    connections = ((CPU_cores * 2) + effective_spindle_count)
 *    For a 4-vCPU database server with SSD storage (spindle = 1):
 *    connections = (4 * 2) + 1 = 9 ~ 10 connections.
 *
 * 2. Node.js Asynchronous Event-Loop Concurrency:
 *    Node.js is single-threaded and non-blocking. A single Node.js process handles
 *    hundreds of concurrent HTTP requests asynchronously with very short DB query hold times.
 *    Allocating too many connections (e.g. 50-100 per instance) creates diminishing returns:
 *    PostgreSQL forks a dedicated backend process per connection (~10MB RAM overhead each).
 *    Excessive connections cause CPU cache thrashing, context-switching overhead, and
 *    buffer cache lock contention on PostgreSQL shared buffers.
 *
 * 3. Horizontal Scaling & Fleet Limits:
 *    If Rota runs 3 API worker instances behind a load balancer, each with max = 10 connections:
 *    Total pool connections = 3 * 10 = 30 connections.
 *    This stays well within PostgreSQL's default `max_connections = 100`, leaving 70 connections
 *    reserved for background BullMQ workers, migrations, and DBA administrative access.
 */
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '10', 10);
const POOL_MIN = parseInt(process.env.DB_POOL_MIN || '2', 10);
const IDLE_TIMEOUT_MS = parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10);
const CONNECTION_TIMEOUT_MS = parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10);
const MAX_USES = parseInt(process.env.DB_MAX_USES || '7500', 10);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mac@localhost:5432/rota_dev',
  max: POOL_MAX,                     // Justified above: 10 connections per instance
  min: POOL_MIN,                     // Keep 2 warm connections alive to eliminate handshake latency
  idleTimeoutMillis: IDLE_TIMEOUT_MS, // Close idle connections after 30s
  connectionTimeoutMillis: CONNECTION_TIMEOUT_MS, // Fail fast after 5s if pool is exhausted
  maxUses: MAX_USES,                 // Recycle connections after 7,500 queries to prevent memory leaks
  keepAlive: true,                   // Enable TCP keepalive
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

export const query = (text: string, params?: unknown[]): Promise<QueryResult<any>> =>
  pool.query(text, params);

/**
 * Returns current pool diagnostic metrics.
 */
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConfigured: POOL_MAX,
    minConfigured: POOL_MIN,
  };
}

/**
 * Database client pool adapter.
 * Provides managed checkout, connection safety, and transaction boundaries.
 */
export const poolAdapter = {
  getPool(): Pool {
    return pool;
  },

  async query<T extends QueryResultRow = any>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
    return pool.query<T>(text, params);
  },

  /**
   * Executes a callback with a dedicated checked-out client,
   * guaranteeing release back to the pool in a finally block.
   */
  async withClient<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      return await callback(client);
    } finally {
      client.release();
    }
  },

  /**
   * Executes a callback within a database transaction.
   * Automatically manages BEGIN, COMMIT, ROLLBACK, and client release.
   */
  async withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Error rolling back transaction:', rollbackErr);
      }
      throw error;
    } finally {
      client.release();
    }
  },
};
