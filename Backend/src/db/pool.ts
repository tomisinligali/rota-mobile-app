import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Connection Pool.
 * Configured with max 10 connections per server instance.
 */
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mac@localhost:5432/rota_dev',
  max: 10, // Max 10 connections per server instance
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

export const query = (text: string, params?: unknown[]): Promise<QueryResult<any>> =>
  pool.query(text, params);

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
