# Engineering Learning Log & Architecture Decisions

This document captures key engineering challenges, concurrency race conditions, trade-offs, and lessons learned while designing and building the Rota scheduling platform.

---

## 1. Concurrency & Database Race Conditions

### 1.1 The Concurrent Registration Thundering Herd
* **The Problem**: When multiple simultaneous registration requests arrive for the exact same email address (e.g. rapid double-clicks on mobile or network retries without idempotency), standard `SELECT` then `INSERT` logic suffers from a classic Time-of-Check to Time-of-Use (TOCTOU) race condition. Both threads see no existing user and proceed to `INSERT`, triggering unhandled unique constraint violations or duplicate tenant accounts.
* **The Solution**: 
  1. We combined PostgreSQL unique constraint `UNIQUE(email)` with an `idempotency_keys` locking mechanism.
  2. The registration handler acquires an idempotency lease before running. If two concurrent threads hit the database simultaneously, the second thread catches the database unique violation (`23505`) and gracefully maps it to a structured domain error (`409 EMAIL_ALREADY_EXISTS`) rather than crashing or returning an unhandled 500 error.
  3. Verified in `test_account_idempotency_and_pooling.ts`: 5 concurrent threads attempting to register the identical email resulted in exactly 1 success and 4 clean 409 responses with zero server errors.

### 1.2 Swap Execution & Stale Shift Assignments
* **The Problem**: In peer shift swaps, a manager might approve a swap while the requesting employee was concurrently removed from the team or while another manager reassigned the shift.
* **The Solution**: 
  - Direct swap execution is wrapped in a PostgreSQL transaction (`REPEATABLE READ` or explicit `SELECT ... FOR UPDATE`).
  - The service verifies that the requesting user is still an active team member, the target shift is still `PUBLISHED`, and the shift assignment has not changed since the swap request was issued.
  - The swap state and shift assignment update happen in the same atomic transaction, preventing orphan approvals.

---

## 2. Settings Coordination & Last-Write-Wins (LWW)

### 2.1 The Nurse Halima Scenario
* **Context**: Nurse manager Halima updates her quiet hours (10:00 PM – 6:00 AM) on her mobile phone. At 2:00 AM, a colleague initiates a shift swap. If settings were stored only on the device, the server would dispatch push notifications, waking Halima on her phone or tablet.
* **Architecture**:
  - The server is the authoritative single source of truth for all user preferences (`quiet_hours_start`, `quiet_hours_end`, `timezone`, `theme`, `language`, `notification_types`).
  - When a notification is generated, the BullMQ worker evaluates `isInQuietHours(settings, targetTimezone)`. If active, the notification's outbox state is deferred until quiet hours conclude (e.g. 6:00 AM), unless flagged as high-priority (`isUrgent: true`).

### 2.2 Last-Write-Wins (LWW) Weaknesses & Mitigations
* **Why LWW Was Chosen**: For personal settings (theme, quiet hours, notification categories), concurrent writes from multiple devices are rare and low-stakes. LWW is simple to implement and requires no complex CRDT operational transforms.
* **The Inherent Weakness**: 
  - LWW relies on client-provided or server-received timestamps. If Device A writes at `T1` while offline and reconnects later, it could overwrite a newer change made at `T2` on Device B if client clocks are out of sync or if network delivery is delayed.
  - If two devices update disjoint fields concurrently (e.g. Phone changes Theme to `DARK`, Tablet changes Language to `FR`), a naive full-record LWW replace causes the second write to clobber the first device's partial update.
* **Mitigations Implemented**:
  1. **Monotonic Server Timestamps**: The server, not the client, assigns `updated_at = NOW()` inside the SQL write statement, preventing client clock skew from corrupting history.
  2. **Field-Level Granular Updates**: The API supports partial patching (`COALESCE($1, field)`), so changing a theme does not overwrite an updated language preference.
  3. **Optimistic UI with Rollback**: Mobile clients apply changes optimistically to React Query cache for immediate feedback, but roll back to server state if the HTTP request fails.

---

## 3. PostgreSQL Exclusion Constraints vs. Application-Level Validation

### 3.1 The Overlap Condition
A shift conflict occurs whenever two active shifts for the same staff member overlap in time:
$$\text{existing.start} < \text{new.end} \quad \text{AND} \quad \text{existing.end} > \text{new.start}$$

### 3.2 Comparison & Decision
* **PostgreSQL Range Types (`tstzrange`) & GiST Exclusion Constraints**:
  - *Pros*: Mathematically impossible to produce overlapping records even under extreme concurrent multi-threaded writes without explicit locks.
  - *Cons*: Requires PostgreSQL `btree_gist` extension; error messages from constraint violations are generic database errors that are difficult to translate into user-friendly conflict details (e.g. which shift, which team member, and which time window conflicted); complex when handling soft-deleted or cancelled shifts.
* **Application-Level Transactional Validation**:
  - *Pros*: Provides rich, contextual feedback to the client (`"Shift conflicts with existing shift on Team Floor B from 10:00 to 18:00"`), respects shift statuses (`CANCELLED` shifts do not trigger conflicts), and allows advisory overrides.
  - *Cons*: Vulnerable to phantom reads under default read-committed isolation unless guarded by transactional locks (`SELECT ... FOR UPDATE` or explicit Redis distributed locks).
* **Our Approach**:
  - We use strict application-level validation inside PostgreSQL transactions with explicit range queries. Before creating or updating a shift, the service queries active (`status != 'CANCELLED'`) shifts for that user within the target interval. Optimistic concurrency versioning (`version = version + 1`) ensures concurrent updates to the same schedule are safely rejected.

---

## 4. Redis Caching & $O(1)$ Invalidation Strategies

### 4.1 The Danger of Pattern Invalidation (`KEYS`)
* **The Pitfall**: In many naive caching designs, when a shift changes, developers execute `redis.keys("team:*:shifts:*")` followed by `redis.del(...)`.
* **Why This Fails**: Redis is single-threaded. Running `KEYS` on an instance with 500,000 keys causes full table iteration, blocking all other Redis operations for tens or hundreds of milliseconds. In production, this causes timeout cascades across API requests.

### 4.2 Our Solution: Versioned Namespace Keys
* To achieve instantaneous $O(1)$ cache invalidation without running pattern scans:
  1. Each team maintains an atomic version counter in Redis: `team:${teamId}:version`.
  2. Cache keys for shift calendars and activity feeds include this version:
     $$\text{Key} = \text{team:}\{\text{teamId}\}\text{:v}\{\text{version}\}\text{:shifts:}\{\text{start}\}\text{-}\{\text{end}\}$$
  3. When any shift is created, updated, cancelled, or swapped, the service executes:
     ```typescript
     await redis.incr(`team:${teamId}:version`);
     ```
  4. **Result**: The team version increments in $O(1)$ time ($<1\text{ ms}$). All previous cache keys with the older version immediately become unreachable and cleanly expire via their natural TTL without a single scan or multi-key delete.

---

## 5. Database Sharding: Complexities & Mitigations

### 5.1 Shard Key Selection
* We selected `team_id` as the primary shard key:
  $$\text{Shard Index} = \text{MD5}(\text{team\_id}) \pmod 2$$
* **Why `team_id`**: 95% of operational scheduling queries in Rota are team-scoped (fetching a team calendar, viewing a roster, claiming an open shift, browsing team activity). Partitioning by `team_id` guarantees that all shift data, availability records, and swap requests for a given team live on the exact same physical database shard. Transactions within a team never require cross-shard coordination.

### 5.2 The Whale Tenant Problem
* **Scenario**: If a 5,000-staff hospital team is placed on Shard 0 alongside regular 10-person cafe teams, Shard 0's CPU, disk I/O, and pool connections become saturated ("noisy neighbor" problem).
* **Mitigation**:
  1. **Dedicated Enterprise Shards**: For teams exceeding 500 staff, the shard router overrides the hash function using an enterprise tenant map, routing that team to an isolated shard instance.
  2. **Virtual Shards / Consistent Hashing**: In production, routing through 1,024 virtual buckets distributed across physical shards allows rebalancing hot shards without resharding the entire keyspace.

### 5.3 Cross-Shard Query Challenges
* **The Hard Queries**:
  1. *User Multi-Team Master Calendar*: A nurse working across Team Emergency (Shard 0) and Team Pediatrics (Shard 1).
  2. *Business Billing Aggregation*: Counting all active staff seats across all teams in a business to bill the owner.
* **How We Solved It**:
  - We implemented a **Scatter-Gather Engine** (`scatterGather` in `Backend/src/db/sharding.ts`).
  - The query is dispatched asynchronously in parallel across all shard pools (`Promise.allSettled`).
  - The API layer merges, sorts, and paginates the combined result sets in memory, tagging each record with its originating `_shard` identifier.

---

## 6. Financial Precision: Exact Integer Proration Math

### 6.1 Why Floats Are Banned
* Standard JavaScript floating-point numbers (`0.1 + 0.2 = 0.30000000000000004`) introduce precision errors when calculating fractional days or mid-cycle seat expansions. Over thousands of recurring transactions, fractional cents accumulate into balancing discrepancies that break accounting audits.

### 6.2 The Exact Integer Cent Formula
* All monetary values in Rota are represented strictly as whole integers in the smallest currency unit (cents / kobo):
  $$\text{Unused Credit} = \left\lfloor \frac{\text{Current Plan Price (cents)} \times \text{Days Remaining}}{\text{Days In Period}} \right\rfloor$$
  $$\text{New Plan Cost} = \left\lfloor \frac{\text{New Plan Price (cents)} \times \text{Days Remaining}}{\text{Days In Period}} \right\rfloor$$
  $$\text{Charge Today} = \max(0, \text{New Plan Cost} - \text{Unused Credit})$$
* **Rounding Convention**: We floor (`Math.floor`) unused credit and floor new plan cost to ensure deterministic rounding. Downgrades or seat reductions calculate a charge of $0.00 today and take effect at the end of the current billing cycle, eliminating credit refund risks.
* Every financial transaction is appended to an immutable `billing_ledger` table protected by PostgreSQL database triggers that permanently forbid `UPDATE` or `DELETE` operations.
