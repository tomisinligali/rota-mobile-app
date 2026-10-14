# System State & Implementation Status

## 1. Project Overview

**Rota** is a mobile-first shift scheduling application built for small businesses (5–100 staff per team). It enforces strict backend authority, multi-tenant isolation, immutable billing audit trails, and resilient background job processing.

- **Mobile App**: React Native (Expo SDK 54), TypeScript, React Query, Zustand.
- **Backend API**: Node.js LTS (v20), Express, TypeScript, PostgreSQL (pg pool), Redis, BullMQ.
- **Repository**: Public GitHub Repository [`https://github.com/tomisinligali/rota-mobile-app`](https://github.com/tomisinligali/rota-mobile-app)
- **Architecture**: Domain-driven monolithic API with read-replica query routing, Redis caching, 2-shard horizontal scaling simulation, and an outbox BullMQ worker.

---

## 2. Implemented Requirements Matrix

| Requirement | Description | Status | Verification Reference |
|---|---|:---:|---|
| **Req 1: Authentication & Account Lifecycle** | Argon2id hashing, secure refresh tokens, revocable sessions, rate-limiting, and idempotent signup with replay protection. | **COMPLETED** | `test_account_idempotency_and_pooling.ts` (22/22 pass) |
| **Req 2: Multi-Tenancy & Authorization** | Hierarchy `Business -> Team -> TeamMembership -> User`. Team-scoped roles (`OWNER`, `MANAGER`, `STAFF`). Strict object-level tenant isolation. | **COMPLETED** | `test_security_suite.ts` (100% pass) |
| **Req 3: Shift Lifecycle & Concurrency** | Scheduling interval overlap checks (`start < end`), optimistic concurrency versioning, publish/cancel status lifecycle. | **COMPLETED** | `test_security_suite.ts` & `shifts.service.ts` |
| **Req 4: Security Hardening** | Zod server validation, SQL injection prevention, cross-tenant IDOR defense, and Redis token bucket rate limiting. | **COMPLETED** | `test_security_suite.ts` (100% pass) |
| **Req 5: Billing & Proration Engine** | Flutterwave integration, exact integer-cent proration math, immutable append-only billing ledger, 7-day grace period, and restricted mode. | **COMPLETED** | `test_proration_and_billing_suite.ts` (45/45 pass) |
| **Req 6: Push Notifications & Outbox** | Multi-device push token registry, async BullMQ delivery, quiet hours with timezone evaluation, category preference filters, and bad token purging. | **COMPLETED** | `test_notifications_suite.ts` (27/27 pass) |
| **Req 7: Settings Coordination** | Server single source of truth, cross-device sync (Halima nurse scenario), Last-Write-Wins (LWW) conflict resolution, and optimistic UI rollback. | **COMPLETED** | `test_requirement_7_coordination.ts` (34/34 pass) |
| **System Design: Connection Pooling** | HikariCP/Postgres formula justified connection pool (`max: 10`, `min: 2`), keepalive, and leak prevention. | **COMPLETED** | `test_system_design_suite.ts` (Test 1) |
| **System Design: Read/Write Routing** | Automatic write -> Primary, read -> Replica, with 5s read-your-own-writes replication lag window. | **COMPLETED** | `test_system_design_suite.ts` (Test 2) |
| **System Design: Database Sharding** | Two distinct PostgreSQL databases (`rota_shard_0`, `rota_shard_1`), routing via $\text{MD5}(\text{team\_id}) \pmod 2$, and parallel scatter-gather queries. | **COMPLETED** | `test_system_design_suite.ts` (Test 3) |
| **System Design: Redis Caching** | Tiered caching for team rosters and shift calendars with $O(1)$ team version counter invalidation. | **COMPLETED** | `test_system_design_suite.ts` (Test 4) |
| **System Design: 200-VU Load Test** | 200 virtual user concurrent benchmark loading activity feed. Latency dropped from 41.23 ms (DB) to 5.29 ms (Redis), an 7.8x speedup. | **COMPLETED** | `test_system_design_suite.ts` (Test 5) |

---

## 3. Database Schema & Migrations

The database schema is managed via forward-only, idempotent SQL migrations in `Backend/src/db/migrations/`:

| Migration | Name | Description |
|---|---|---|
| `001` | `create_users_table` | Stores credentials, email, Argon2id password hash, and timestamps. |
| `002` | `create_businesses_and_teams` | Establishes the billing and scheduling boundaries. |
| `003` | `create_team_memberships` | Associates users to teams with roles (`OWNER`, `MANAGER`, `STAFF`). |
| `004` | `create_shifts_table` | Stores shift timestamps, status (`DRAFT`, `PUBLISHED`, `CANCELLED`), and version counter. |
| `005` | `create_swaps_table` | Manages direct swap and open shift assignment lifecycles. |
| `006` | `create_availability_and_preferences` | Advisory scheduling availability rules. |
| `007` | `create_audit_logs` | Immutable audit trail for team operations. |
| `008` | `create_subscriptions` | Business billing plans (`STARTER`, `TEAM`, `BUSINESS`), seat allowances, and grace periods. |
| `009` | `create_billing_ledger` | Immutable financial ledger protected by PostgreSQL triggers against `UPDATE` and `DELETE`. |
| `010` | `create_idempotency_keys` | Locks and caches mutation responses for retry-safe operations. |
| `011` | `create_refresh_tokens` | Revocable session management tokens. |
| `012` | `create_notifications_and_outbox` | Durable outbox table for asynchronous BullMQ delivery. |
| `013` | `create_user_settings` | Server single source of truth for quiet hours, timezone, and theme. |
| `014` | `device_tokens_and_notification_preferences` | Multi-device push token storage and notification category toggles. |
| `015` | `add_language_to_user_settings` | Multi-device language synchronization with server timestamps. |

---

## 4. Active Domain Models

The backend is arranged into domain packages under `Backend/src/domains/`:
- **`auth/`**: Registration, login, refresh token rotation, session revocation.
- **`billing/`**: Proration math, Flutterwave integration, webhook event deduplication, and immutable ledger queries.
- **`shifts/`**: Shift creation, calendar range retrieval, overlap validation, and version incrementing.
- **`swaps/`**: Direct peer swaps, open shift claims, atomic approval transactions, and notifications.
- **`teams/`**: Business creation, team management, roster listings, seat checks, and audit feed logging.
- **`users/`**: Profile management, device token registration, and settings synchronization.
- **`notifications/`**: Notification intent logging, BullMQ outbox processor, Expo push dispatcher, and quiet hours evaluation.

---

## 5. Automated Verification Summary

All test suites execute against real local PostgreSQL databases and Redis instances:

```text
============================================================
TEST SUITE SUMMARY
============================================================
1. Security & RBAC Suite:            100% PASS (4/4 test groups)
2. Proration & Billing Suite:        100% PASS (45/45 tests)
3. Account Idempotency & Pooling:    100% PASS (22/22 tests)
4. Push Notifications Suite:         100% PASS (27/27 tests)
5. Settings Coordination Suite:      100% PASS (34/34 tests)
6. Backend System Design Suite:      100% PASS (36/36 tests)
------------------------------------------------------------
TOTAL AUTOMATED ASSERTIONS:          168+ PASS (0 FAILURES)
============================================================
```
