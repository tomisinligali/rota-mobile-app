import { Pool, QueryResult, QueryResultRow } from 'pg';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export interface ShardConfig {
  shardIndex: number;
  dbName: string;
  connectionString: string;
}

const SHARD_0_URL =
  process.env.SHARD_0_DATABASE_URL || 'postgresql://mac@localhost:5432/rota_shard_0';
const SHARD_1_URL =
  process.env.SHARD_1_DATABASE_URL || 'postgresql://mac@localhost:5432/rota_shard_1';

export const shard0Pool = new Pool({
  connectionString: SHARD_0_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const shard1Pool = new Pool({
  connectionString: SHARD_1_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

shard0Pool.on('error', (err) => {
  console.error('[ShardManager] Error on idle client in Shard 0:', err);
});

shard1Pool.on('error', (err) => {
  console.error('[ShardManager] Error on idle client in Shard 1:', err);
});

export const shardPools: Pool[] = [shard0Pool, shard1Pool];

/**
 * Deterministically computes the shard index (0 or 1) for a given team_id.
 * Uses MD5 hash modulo 2 to ensure uniform distribution across shards.
 */
export function getShardIndex(teamId: string): number {
  if (!teamId) {
    throw new Error('Shard key team_id is required');
  }
  const hash = crypto.createHash('md5').update(teamId.trim().toLowerCase()).digest();
  // Read first 4 bytes as unsigned 32-bit integer
  const intVal = hash.readUInt32BE(0);
  return intVal % shardPools.length;
}

/**
 * Returns the designated shard pool and metadata for a team.
 */
export function getShardForTeam(teamId: string): {
  shardIndex: number;
  dbName: string;
  pool: Pool;
} {
  const shardIndex = getShardIndex(teamId);
  return {
    shardIndex,
    dbName: shardIndex === 0 ? 'rota_shard_0' : 'rota_shard_1',
    pool: shardPools[shardIndex],
  };
}

/**
 * Executes a query directly on the team's assigned shard.
 */
export async function queryShard<T extends QueryResultRow = any>(
  teamId: string,
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const { pool, shardIndex } = getShardForTeam(teamId);
  return pool.query<T>(text, params);
}

/**
 * Scatter-Gather Query Execution:
 * Runs the query across ALL shards in parallel and aggregates the results.
 * Used for cross-shard operations (e.g. querying a user's memberships across all teams).
 */
export async function scatterGather<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[]
): Promise<{ shardIndex: number; rows: T[] }[]> {
  const promises = shardPools.map(async (pool, idx) => {
    const res = await pool.query<T>(text, params);
    return {
      shardIndex: idx,
      rows: res.rows,
    };
  });

  return Promise.all(promises);
}

/**
 * Verifies connectivity to both shard databases.
 */
export async function verifyShards(): Promise<{
  shard0: boolean;
  shard1: boolean;
  shard0Db: string;
  shard1Db: string;
}> {
  const [res0, res1] = await Promise.all([
    shard0Pool.query('SELECT current_database() as db'),
    shard1Pool.query('SELECT current_database() as db'),
  ]);

  return {
    shard0: res0.rows.length > 0,
    shard1: res1.rows.length > 0,
    shard0Db: res0.rows[0].db,
    shard1Db: res1.rows[0].db,
  };
}
