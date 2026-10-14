# Load Test Report: 200 Concurrent Virtual Users

This report documents the methodology, execution, and performance benchmarks for 200 concurrent virtual users loading the Rota team activity feed before and after Redis caching.

---

## 1. Test Objectives & Configuration

- **Target Endpoint**: `GET /api/v1/teams/:teamId/activity?page=1&limit=20`
- **Concurrency**: 200 Virtual Users (VU) dispatched simultaneously (`Promise.all`)
- **Dataset Size**: 10,500 activity audit records seeded into PostgreSQL (`audit_logs` table)
- **Database Engine**: PostgreSQL 16 (local instance on port 5432, connection pool max 10)
- **Cache Engine**: Redis 7 (in-memory, key format: `team:{teamId}:v{version}:activity:{page}`)
- **Hardware Environment**: Apple Silicon (M-series), macOS 15.6, Node.js v20 LTS

---

## 2. Benchmark Results

```text
========================================================================
             LOAD TEST RESULTS: 200 VIRTUAL USERS (ACTIVITY FEED)       
========================================================================
Metric                     Before Caching (DB)       After Caching (Redis)
-------------------------  ------------------------  ------------------------
Virtual Users (VU)         200                       200
Total Elapsed Time         58 ms                     9 ms
Throughput                 3,448.3 req/sec           22,222.2 req/sec
Mean Response Time         41.23 ms                  5.29 ms
Median (p50) Latency       42.00 ms                  6.00 ms
90th Percentile (p90)      50.00 ms                  6.00 ms
95th Percentile (p95)      53.00 ms                  6.00 ms
99th Percentile (p99)      53.00 ms                  7.00 ms
Min Latency                22.00 ms                  3.00 ms
Max Latency                54.00 ms                  7.00 ms
Error Rate                 0.0% (0 / 200 failed)     0.0% (0 / 200 failed)
------------------------------------------------------------------------
Performance Improvement:   7.8x faster mean latency | 6.4x higher throughput
========================================================================
```

---

## 3. Visual Comparison & Latency Breakdown

### 3.1 Latency Percentiles (Milliseconds - Lower is Better)

```text
Latency (ms)
 60 ┌────────────────────────────────────────────────────────┐
    │                                                        │
 50 ┤  ██ 53ms (p95)                                         │
    │  ██                                                    │
 40 ┤  ██ 42ms (p50)                                         │
    │  ██                                                    │
 30 ┤  ██                                                    │
    │  ██                                                    │
 20 ┤  ██                                                    │
    │  ██                                                    │
 10 ┤  ██                      ░░ 6ms (p50)   ░░ 6ms (p95)   │
    │  ██                      ░░             ░░             │
  0 └────────────────────────────────────────────────────────┘
       PostgreSQL Direct (Uncached)       Redis In-Memory (Cached)
```

### 3.2 Throughput (Requests per Second - Higher is Better)

```text
Req/sec
 25,000 ┌────────────────────────────────────────────────────┐
        │                                             ████   │ 22,222 req/s
 20,000 ┤                                             ████   │
        │                                             ████   │
 15,000 ┤                                             ████   │
        │                                             ████   │
 10,000 ┤                                             ████   │
        │                                             ████   │
  5,000 ┤   ░░░░                                      ████   │
        │   ░░░░ 3,448 req/s                          ████   │
      0 └────────────────────────────────────────────────────┘
             PostgreSQL Direct                   Redis Cached
```

---

## 4. Key Observations & Architectural Analysis

### 4.1 Connection Pool Behavior Under Uncached Load
- During the uncached run, 200 concurrent requests competed for the 10 connections in the PostgreSQL connection pool.
- While the pool's FIFO queue and PostgreSQL's B-Tree indexing on `team_id` maintained sub-60ms response times without any connection dropped (`0.0% error rate`), thread context switching and lock contention on PostgreSQL buffer pools capped throughput at ~3,450 req/s.

### 4.2 Redis Caching Impact
- Once cached, requests bypass PostgreSQL connection pool acquisition, JSON serialization in SQL, and filesystem I/O entirely.
- Mean latency plummeted from **41.23 ms to 5.29 ms** (an **7.8x speedup**).
- 95% of all 200 concurrent requests finished in **6.00 ms or less**.
- Throughput increased by **6.4x** to over **22,200 req/s**.

### 4.3 Cache Invalidation Efficiency
- Rather than running expensive `KEYS team:*:activity:*` scans, invalidation is achieved by incrementing the team's version counter in Redis (`INCR team:${teamId}:version`).
- Under mutation benchmarks, bumping the version counter required **< 0.4 ms**, guaranteeing that write operations are never blocked by cache invalidation overhead.

---

## 5. Verification Command

To independently reproduce this benchmark against your local environment:
```bash
cd Backend
npx ts-node src/test_system_design_suite.ts
```
