import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const cacheRedis = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

cacheRedis.connect().catch((err) => {
  console.warn('[CacheManager] Redis connection warning:', err.message);
});

cacheRedis.on('error', (err) => {
  console.warn('[CacheManager] Redis error:', err.message);
});

// Cache TTL Configurations
export const CACHE_TTL = {
  ROSTER: 300,        // 5 minutes
  CALENDAR: 120,      // 2 minutes
  ACTIVITY_FEED: 60,  // 1 minute
  DEFAULT: 180,       // 3 minutes
};

/**
 * Cache abstraction for Rota.
 */
export const CacheService = {
  /**
   * Retrieves a cached JSON object.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (cacheRedis.status !== 'ready') return null;
      const raw = await cacheRedis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (err: any) {
      console.warn(`[CacheService] Failed to read key ${key}:`, err.message);
      return null;
    }
  },

  /**
   * Serializes and sets a JSON object in cache with TTL.
   */
  async set(key: string, value: any, ttlSeconds: number = CACHE_TTL.DEFAULT): Promise<void> {
    try {
      if (cacheRedis.status !== 'ready') return;
      const serialized = JSON.stringify(value);
      await cacheRedis.set(key, serialized, 'EX', ttlSeconds);
    } catch (err: any) {
      console.warn(`[CacheService] Failed to write key ${key}:`, err.message);
    }
  },

  /**
   * Deletes a single key.
   */
  async del(key: string): Promise<void> {
    try {
      if (cacheRedis.status !== 'ready') return;
      await cacheRedis.del(key);
    } catch (err: any) {
      console.warn(`[CacheService] Failed to delete key ${key}:`, err.message);
    }
  },

  /**
   * Atomically bumps the team version key.
   * This provides an O(1) instant cache invalidation for all variable-range shift queries
   * and activity feed pages for a team without expensive KEYS/SCAN scans.
   */
  async bumpTeamVersion(teamId: string): Promise<number> {
    try {
      if (cacheRedis.status !== 'ready') return 1;
      return await cacheRedis.incr(`team:${teamId}:version`);
    } catch {
      return 1;
    }
  },

  async getTeamVersion(teamId: string): Promise<number> {
    try {
      if (cacheRedis.status !== 'ready') return 1;
      const v = await cacheRedis.get(`team:${teamId}:version`);
      return v ? parseInt(v, 10) : 1;
    } catch {
      return 1;
    }
  },

  // -------------------------------------------------------------
  // Team Roster Caching
  // -------------------------------------------------------------
  async getTeamRoster(teamId: string): Promise<any[] | null> {
    return this.get<any[]>(`team:${teamId}:roster`);
  },

  async setTeamRoster(teamId: string, roster: any[]): Promise<void> {
    await this.set(`team:${teamId}:roster`, roster, CACHE_TTL.ROSTER);
  },

  async invalidateTeamRoster(teamId: string): Promise<void> {
    await this.del(`team:${teamId}:roster`);
  },

  // -------------------------------------------------------------
  // Shift Calendar Caching
  // -------------------------------------------------------------
  async getTeamShifts(teamId: string, rangeKey: string = 'all'): Promise<any[] | null> {
    const version = await this.getTeamVersion(teamId);
    return this.get<any[]>(`team:${teamId}:v${version}:shifts:${rangeKey}`);
  },

  async setTeamShifts(teamId: string, rangeKey: string = 'all', shifts: any[]): Promise<void> {
    const version = await this.getTeamVersion(teamId);
    await this.set(`team:${teamId}:v${version}:shifts:${rangeKey}`, shifts, CACHE_TTL.CALENDAR);
  },

  // -------------------------------------------------------------
  // Activity Feed Caching
  // -------------------------------------------------------------
  async getActivityFeed(teamId: string, pageKey: string = 'p1'): Promise<any | null> {
    const version = await this.getTeamVersion(teamId);
    return this.get<any>(`team:${teamId}:v${version}:activity:${pageKey}`);
  },

  async setActivityFeed(teamId: string, pageKey: string = 'p1', feed: any): Promise<void> {
    const version = await this.getTeamVersion(teamId);
    await this.set(`team:${teamId}:v${version}:activity:${pageKey}`, feed, CACHE_TTL.ACTIVITY_FEED);
  },

  /**
   * Comprehensive Invalidation:
   * Called whenever a shift is created, updated, cancelled, published, or swapped.
   * Atomically invalidates shift calendars, rosters, and activity feed for that team!
   */
  async invalidateTeamSchedule(teamId: string): Promise<void> {
    await Promise.all([
      this.bumpTeamVersion(teamId),
      this.invalidateTeamRoster(teamId),
      this.del(`team:${teamId}:roster`),
    ]);
  },
};
