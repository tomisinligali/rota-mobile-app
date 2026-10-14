# Database Sharding Architecture & Strategy

This document details the horizontal database sharding architecture for Rota, explaining the shard key selection, hot shard handling for massive teams, and cross-shard query trade-offs.

---

## 1. Overview & Simulation Topology

Rota implements horizontal application-level sharding across multiple isolated PostgreSQL databases:
- **Shard 0**: `rota_shard_0`
- **Shard 1**: `rota_shard_1`

Routing is deterministically computed via cryptographic hash modulo the shard count:
$$\text{shard\_index} = \text{MD5}(\text{team\_id}) \pmod 2$$

All data belonging to a team (shifts, shift assignments, shift swaps, schedules, availability, and activity logs) is colocated within that team's designated database shard.

---

## 2. Shard Key Selection: Why `team_id`?

In Rota, the primary ownership hierarchy is:
```text
Business (Billing Boundary)
  └── Team (Scheduling & Authorization Boundary)
       └── TeamMembership
             └── User
```

`team_id` was chosen as the authoritative shard key for three fundamental reasons:

### 2.1 Natural Scheduling & Isolation Boundary
Over 95% of database reads and writes in Rota operate within the scope of a single team:
- Generating, viewing, and editing weekly shift schedules.
- Running scheduling conflict detection (`existing.start < new.end AND existing.end > new.start`).
- Proposing and executing direct shift swaps between coworkers.
- Reading the team roster and staff availability.

By sharding on `team_id`, **every scheduling and shift operation executes entirely within a single database shard**. Complex joins between `shifts`, `team_memberships`, and `users` remain high-speed local SQL joins without cross-network network round-trips or distributed transactions.

### 2.2 Preserving Transactional Integrity
PostgreSQL transactions (`BEGIN ... COMMIT`) cannot natively span independent database instances without heavy two-phase commit protocols (XA / 2PC). Sharding on `team_id` guarantees that critical atomic operations—such as approving a shift swap and swapping assigned user IDs—occur in a single local ACID transaction.

### 2.3 Strict Tenant Isolation
Sharding by team naturally reinforces tenant isolation. A security breach or resource exhaustion on one shard does not degrade performance or compromise data on other shards.

---

## 3. How to Handle a Very Large Team (The "Whale Tenant" / Hot Shard Problem)

### 3.1 The Problem
While standard teams have 5–50 staff, enterprise teams (e.g., a major hospital ward, airport ground crew, or retail chain) may have 500–2,000+ staff. 
If an entire team must live on one shard, a massive team can overwhelm a single PostgreSQL instance's CPU, disk I/O, and buffer pool, creating a **Hot Shard** (skewed resource utilization where Shard 0 is at 95% CPU while Shard 1 is idle).

### 3.2 Architectural Solutions for Large Teams

1. **Dedicated Shard Allocation (Enterprise Isolation)**:
   Instead of algorithmic hashing, implement a directory lookup table (routing metadata) for outlier teams:
   - Small & medium teams use hash-based sharding ($\text{team\_id} \pmod N$).
   - Massive teams ("whale tenants") are routed to a dedicated, high-spec PostgreSQL instance (`rota_shard_enterprise_1`).

2. **Sub-Sharding by Sub-Department / Location / Ward**:
   Decompose large organizations into nested teams or units (e.g., `Emergency Ward`, `Intensive Care`, `Pediatrics`) rather than a single monolithic team. Each unit gets its own `team_id` and can be distributed across different shards.

3. **Range Partitioning by Time within the Shard (Hybrid Sharding)**:
   Large teams generate massive shift tables. Within the shard, partition the `shifts` and `activity_logs` tables using PostgreSQL declarative range partitioning on `start_time` (e.g. monthly partitions). Historical shifts are archived to cold storage, keeping the active working dataset memory-resident in PostgreSQL shared buffers.

4. **Virtual Bucket Sharding (Consistent Hashing)**:
   Map teams to 1,024 virtual buckets, and map buckets to physical databases. When a team grows abnormally large, its bucket can be dynamically migrated to an unencumbered database without re-hashing all other teams.

---

## 4. Which Queries Became Harder? (Cross-Shard Query Analysis)

While single-team scheduling queries remain fast and local, sharding on `team_id` makes cross-team and global queries significantly more complex:

### 4.1 Users Belonging to Multiple Teams Across Different Shards
- **Challenge**: A nurse may work day shifts on Team A (mapped to Shard 0) and weekend shifts on Team B (mapped to Shard 1).
- **Impact**: When the mobile app calls `GET /api/v1/shifts/my-shifts` to display the user's unified personal calendar, a single SQL query cannot satisfy the request.
- **Solution**: The API layer must perform a **Scatter-Gather** pattern:
  1. Determine all teams the user belongs to.
  2. Query Shard 0 for Team A shifts and Shard 1 for Team B shifts in parallel via `Promise.all`.
  3. Merge, sort, and deduplicate the resulting arrays in Node.js before returning `{ data: combinedShifts }`.

### 4.2 Cross-Team Shift Coverage & Open Shift Claims
- **Challenge**: If an open shift in Team A can be claimed by an eligible floating staff member in Team B, validating that the staff member has no overlapping shifts in Team B requires querying across shard boundaries.
- **Impact**: Local database uniqueness or overlap exclusion constraints cannot verify non-overlap across shards.
- **Solution**: Application-level distributed lock on the user ID (`lock:user:${userId}`) plus a two-phase check across both shards.

### 4.3 Business-Level Billing Aggregation
- **Challenge**: Subscription billing is business-level, calculated from the total count of active staff seats across all teams in that business.
- **Impact**: If a business has 10 teams distributed across Shard 0 and Shard 1, counting total distinct billable staff requires executing `SELECT user_id FROM team_memberships` on all shards and calculating the union set in the billing service.

### 4.4 Global Reporting & Activity Audit Logs
- **Challenge**: Generating an organization-wide compliance or audit export cannot be done with a single `SELECT ... FROM activity_logs ORDER BY created_at DESC LIMIT 50`.
- **Impact**: Requires distributed k-way merge sorting across shard result streams.

---

## 5. Summary Table

| Operation | Non-Sharded Complexity | Sharded by `team_id` Complexity | Routing Strategy |
| :--- | :--- | :--- | :--- |
| **Team Shift Schedule** | $O(1)$ local query | $O(1)$ local query | Single shard via $\text{hash}(\text{team\_id})$ |
| **Team Shift Conflict Check** | $O(1)$ DB constraint | $O(1)$ DB constraint | Single shard via $\text{hash}(\text{team\_id})$ |
| **Direct Shift Swap** | 1 local transaction | 1 local transaction | Single shard via $\text{hash}(\text{team\_id})$ |
| **User Multi-Team Schedule** | 1 join query | Scatter-gather query | Parallel fan-out to all shards + Node merge |
| **Business Total Seats** | 1 `COUNT(DISTINCT)` | Fan-out union query | Scatter across shards + in-memory Set |
| **Cross-Team Shift Transfer** | 1 transaction | Two-phase coordination | Application lock + distributed commit |
